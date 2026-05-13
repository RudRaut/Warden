#include <iostream>
#include <fstream>
#include <iomanip>
#include <sstream>
#include <unordered_map>
#include <sys/inotify.h>
#include <unistd.h>
#include <sys/stat.h>
#include <openssl/evp.h>
#include <filesystem>
#include <chrono>
#include <ctime>
#include <hiredis/hiredis.h>

namespace fs = std::filesystem;

#define EVENT_SIZE  (sizeof(struct inotify_event))
#define BUF_LEN     (1024 * (EVENT_SIZE + 16))

// Global Variables
std::unordered_map<std::string, std::string>  last_known_hashes;
std::unordered_map<std::string, long long>    last_event_time_ms;  // per-file cooldown tracker
redisContext *redis_conn;

// Minimum milliseconds between two processed events for the same file.
// Prevents duplicate inotify bursts (e.g. IN_CLOSE_WRITE + IN_CREATE from
// editor rename-over, or double IN_CLOSE_WRITE from some filesystems).
constexpr long long EVENT_COOLDOWN_MS = 500;

void push_to_redis(std::string time, std::string action, std::string path, std::string hash, std::string file_name, long file_size, long long event_read_ts);

std::string get_current_time() {
    auto now = std::chrono::system_clock::now();
    std::time_t now_time = std::chrono::system_clock::to_time_t(now);
    struct tm *timeinfo = std::localtime(&now_time);
    
    char buffer[20];
    // Formats time as YYYY-MM-DD HH:MM:SS
    std::strftime(buffer, sizeof(buffer), "%Y-%m-%d %H:%M:%S", timeinfo);
    return std::string(buffer);
}

long long get_current_time_ms() {
    auto now = std::chrono::system_clock::now();
    return std::chrono::duration_cast<std::chrono::milliseconds>(now.time_since_epoch()).count();
}

// Forward Declaration
std::string calculate_sha256_evp(const std::string& path);

void perform_initial_scan(const std::string& target_dir) {
    std::cout << "[WARDEN] Initializing: Scanning existing files..." << std::endl;
    
    try {
        for (const auto& entry : fs::recursive_directory_iterator(target_dir)) {
            if (entry.is_regular_file()) {
                std::string fileName = entry.path().filename().string();
                
                // Filter out hidden/swap files during scan
                if (fileName[0] == '.' || fileName.find(".swp") != std::string::npos) continue;

                std::string fullPath = entry.path().string();
                std::string currentHash = calculate_sha256_evp(fullPath);

                if (!currentHash.empty()) {
                    // Record them as 'Pre-existing'
                    last_known_hashes[fileName] = currentHash;
                    std::cout << "[WARDEN] EXISTING: " << fileName << " (Initial Hash Captured)" << std::endl;
                }
            }
        }
    } catch (const fs::filesystem_error& e) {
        std::cerr << "Scan Error: " << e.what() << std::endl;
    }
    
    std::cout << "[WARDEN] Initialization Complete. " << last_known_hashes.size() << " files cataloged." << std::endl;
}

void process_file_event(struct inotify_event* event, const std::string& target_dir) {
    std::string fileName = event->name;
    if (fileName.empty() || fileName[0] == '.' || fileName.find(".swp") != std::string::npos) return;

    // Capture the inotify detection timestamp immediately (Metric 1: Event Capture Latency)
    long long event_read_ts = get_current_time_ms();

    // --- Per-file cooldown deduplication ---
    // Inotify can fire multiple events (IN_CLOSE_WRITE + IN_CREATE, or two
    // IN_CLOSE_WRITE bursts) for a single logical write. We suppress any
    // event for the same file that arrives within EVENT_COOLDOWN_MS of the
    // last event we already processed for that file.
    auto cooldown_it = last_event_time_ms.find(fileName);
    if (cooldown_it != last_event_time_ms.end()) {
        long long elapsed = event_read_ts - cooldown_it->second;
        if (elapsed < EVENT_COOLDOWN_MS) {
            return; // duplicate burst — suppress
        }
    }

    std::string fullPath = target_dir + "/" + fileName;
    std::string timeStr = get_current_time();

    // 1. Handle Deletions (Priority)
    if (event->mask & IN_DELETE || event->mask & IN_MOVED_FROM) {
        push_to_redis(timeStr, "DELETED", fullPath, "NULL", fileName, 0, event_read_ts);
        last_known_hashes.erase(fileName);
        last_event_time_ms[fileName] = event_read_ts;  // start cooldown
        return;
    }

    // 2. Handle Creations and Modifications
    if (event->mask & IN_CREATE || event->mask & IN_CLOSE_WRITE || event->mask & IN_MOVED_TO) {
        struct stat st;
        if (stat(fullPath.c_str(), &st) != 0) return;

        std::string currentHash = calculate_sha256_evp(fullPath);

        // Skip empty hash noise (e3b0c4...)
        if (currentHash == "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855") return;

        auto it = last_known_hashes.find(fileName);
        std::string action = (it == last_known_hashes.end()) ? "CREATED" : "MODIFIED";

        // Deduplication: Only act if it's new OR the hash has actually changed
        if (it == last_known_hashes.end() || it->second != currentHash) {
            long fileSize = static_cast<long>(st.st_size);

            push_to_redis(timeStr, action, fullPath, currentHash, fileName, fileSize, event_read_ts);
            last_known_hashes[fileName] = currentHash;
            last_event_time_ms[fileName] = event_read_ts;  // start cooldown
        }
    }
}
void init_redis() {
    redis_conn = redisConnect("127.0.0.1", 6379);
    if (redis_conn == NULL || redis_conn->err) {
        if (redis_conn) {
            std::cerr << "[WARDEN] Redis Error: " << redis_conn->errstr << std::endl;
            redisFree(redis_conn);
        } else {
            std::cerr << "[WARDEN] Can't allocate redis context" << std::endl;
        }
        exit(1);
    }
    std::cout << "[WARDEN] Successfully connected to Redis Shock Absorber." << std::endl;
}

std::string escape_json_string(const std::string& input) {
    std::ostringstream ss;
    for (char c : input) {
        switch (c) {
            case '"': ss << "\\\""; break;
            case '\\': ss << "\\\\"; break;
            case '\b': ss << "\\b"; break;
            case '\f': ss << "\\f"; break;
            case '\n': ss << "\\n"; break;
            case '\r': ss << "\\r"; break;
            case '\t': ss << "\\t"; break;
            default:
                if ('\x00' <= c && c <= '\x1f') {
                    ss << "\\u" << std::hex << std::setw(4) << std::setfill('0') << (int)c;
                } else {
                    ss << c;
                }
        }
    }
    return ss.str();
}

void push_to_redis(std::string time, std::string action, std::string path, std::string hash, std::string file_name, long file_size, long long event_read_ts) {
    long long pre_push_ts = get_current_time_ms();

    // Build JSON payload — agent_ts is the millisecond epoch timestamp for E2E tracking
    std::string json_payload = "{"
                               "\"time\": \"" + time + "\", "
                               "\"agent_ts\": " + std::to_string(pre_push_ts) + ", "
                               "\"action\": \"" + action + "\", "
                               "\"path\": \"" + escape_json_string(path) + "\", "
                               "\"file_name\": \"" + escape_json_string(file_name) + "\", "
                               "\"hash\": \"" + hash + "\", "
                               "\"file_size\": " + std::to_string(file_size) + 
                               "}";
    
    redisReply *reply = (redisReply *)redisCommand(redis_conn, "LPUSH warden_events %s", json_payload.c_str());
    long long post_push_ts = get_current_time_ms();

    if (reply == NULL) {
        std::cerr << "[WARDEN] Redis Push Failed!" << std::endl;
        return;
    }
    freeReplyObject(reply);

    // Log capture latency: inotify detection → Redis push completion (Metric 1)
    fprintf(stderr, "[PERF] capture_latency_ms=%lld agent_ts=%lld\n",
            post_push_ts - event_read_ts, pre_push_ts);
}

// --- Hashing Logic (Non-Deprecated EVP) ---
std::string calculate_sha256_evp(const std::string& path) {
    unsigned char hash[EVP_MAX_MD_SIZE];
    unsigned int hash_len = 0;
    EVP_MD_CTX* ctx = EVP_MD_CTX_new();
    if (!ctx) return "";

    if (1 != EVP_DigestInit_ex(ctx, EVP_sha256(), NULL)) {
        EVP_MD_CTX_free(ctx);
        return "";
    }

    std::ifstream file(path, std::ios::binary);
    if (!file.is_open()) {
        EVP_MD_CTX_free(ctx);
        return "";
    }

    char buffer[32768]; 
    while (file.read(buffer, sizeof(buffer)) || file.gcount()) {
        if (1 != EVP_DigestUpdate(ctx, buffer, file.gcount())) {
            EVP_MD_CTX_free(ctx);
            return "";
        }
    }

    if (1 != EVP_DigestFinal_ex(ctx, hash, &hash_len)) {
        EVP_MD_CTX_free(ctx);
        return "";
    }

    EVP_MD_CTX_free(ctx);
    std::stringstream ss;
    for (unsigned int i = 0; i < hash_len; i++) {
        ss << std::hex << std::setw(2) << std::setfill('0') << (int)hash[i];
    }
    return ss.str();
}

int main() {
    const std::string target_dir = "/home/rud/monitored_files";

    // 1. Initialize Components
    init_redis();
    perform_initial_scan(target_dir);

    // 2. Set up Inotify
    int fd = inotify_init();
    if (fd < 0) return 1;

    // Watch for Create, Delete, Close_Write (Saves), and Moves
    int wd = inotify_add_watch(fd, target_dir.c_str(), 
        IN_CREATE | IN_DELETE | IN_CLOSE_WRITE | IN_MOVED_TO | IN_MOVED_FROM);
    
    if (wd < 0) {
        std::cerr << "[WARDEN] Error adding inotify watch for: " << target_dir << std::endl;
        close(fd);
        return 1;
    }

    std::cout << "[WARDEN] Monitoring Active. Awaiting events..." << std::endl;

    char buffer[BUF_LEN];
    while (true) {
        int length = read(fd, buffer, BUF_LEN);
        int i = 0;
        while (i < length) {
            struct inotify_event* event = (struct inotify_event*)&buffer[i];
            if (event->len) {
                process_file_event(event, target_dir);
            }
            i += EVENT_SIZE + event->len;
        }
    }

    redisFree(redis_conn);
    return 0;
}