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

namespace fs = std::filesystem;

#define EVENT_SIZE  (sizeof(struct inotify_event))
#define BUF_LEN     (1024 * (EVENT_SIZE + 16))

std::unordered_map<std::string, std::string> last_known_hashes;

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
    // static std::unordered_map<std::string, std::string> last_known_hashes;
    std::string fileName = event->name;

    if (fileName.empty() || fileName[0] == '.' || fileName.find(".swp") != std::string::npos) return;

    // --- BLOCK 1: DELETED (PRIORITY) ---
    // Check the mask BEFORE calling stat(). If we stat a deleted file, the function returns.
    if (event->mask & IN_DELETE || event->mask & IN_MOVED_FROM) {
        std::cout << "[WARDEN] DELETED: " << fileName << std::endl;
        last_known_hashes.erase(fileName); 
        return; 
    }

    std::string fullPath = target_dir + "/" + fileName;
    struct stat st;

    // --- BLOCK 2: CREATED ---
    if (event->mask & IN_CREATE) {
        // If it's a creation, the file MUST exist to hash it
        if (stat(fullPath.c_str(), &st) != 0) return;

        std::string currentHash = calculate_sha256_evp(fullPath);
        if (currentHash == "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855") return;

        std::cout << "[WARDEN] CREATED: " << fileName << " | Hash: " << currentHash << std::endl;
        last_known_hashes[fileName] = currentHash;
        return;
    }

    // --- BLOCK 3: MODIFIED ---
    if (event->mask & IN_CLOSE_WRITE || event->mask & IN_MOVED_TO) {
        if (stat(fullPath.c_str(), &st) != 0) return;

        std::string currentHash = calculate_sha256_evp(fullPath);
        
        if (last_known_hashes.count(fileName)) {
            if (last_known_hashes[fileName] != currentHash) {
                std::cout << "[WARDEN] MODIFIED: " << fileName << " | Hash: " << currentHash << std::endl;
                last_known_hashes[fileName] = currentHash;
            }
        } else {
            // Catch for files created/written too fast for IN_CREATE
            if (currentHash != "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855") {
                std::cout << "[WARDEN] CREATED: " << fileName << " | Hash: " << currentHash << std::endl;
                last_known_hashes[fileName] = currentHash;
            }
        }
    }
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

    // IMPORTANT: Make sure this path exists
    const std::string target_dir = "/home/rud/monitored_files";
    perform_initial_scan(target_dir);
    
    int fd = inotify_init();
    if (fd < 0) return 1;


    // Explicitly watch for all states
    int wd = inotify_add_watch(fd, target_dir.c_str(), IN_CREATE | IN_DELETE | IN_CLOSE_WRITE | IN_MOVED_TO);

    std::cout << "[WARDEN] Monitoring Active. Clean logs only." << std::endl;

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
    return 0;
}

