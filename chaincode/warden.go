package main

import (
	"encoding/json"
	"fmt"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// WardenAuditContract defines the Smart Contract for FIM auditing
type WardenAuditContract struct {
	contractapi.Contract
}

// EpochRecord matches your specified architecture
type EpochRecord struct {
	EpochID    string `json:"epochID"`    // Unique ID from Python (e.g., "E-1711181400")
	MerkleRoot string `json:"merkleRoot"` // The root hash provided by Python
	EventCount int    `json:"eventCount"` // Number of FIM events in this 60s window
	Timestamp  string `json:"timestamp"`  // ISO/RFC timestamp from Python
}

// RecordEpoch anchors the Merkle Root and metadata to the ledger
func (s *WardenAuditContract) RecordEpoch(ctx contractapi.TransactionContextInterface, epochID string, merkleRoot string, eventCount int, timestamp string) error {
	// Check if this epoch was already recorded
	exists, err := s.EpochExists(ctx, epochID)
	if err != nil {
		return err
	}
	if exists {
		return fmt.Errorf("epoch %s already has an anchored record", epochID)
	}

	// Initialize the record with your specific inputs
	record := EpochRecord{
		EpochID:    epochID,
		MerkleRoot: merkleRoot,
		EventCount: eventCount,
		Timestamp:  timestamp,
	}

	recordJSON, err := json.Marshal(record)
	if err != nil {
		return err
	}

	// Commit to the World State
	return ctx.GetStub().PutState(epochID, recordJSON)
}

// GetEpoch fetches the full record for forensic verification
func (s *WardenAuditContract) GetEpoch(ctx contractapi.TransactionContextInterface, epochID string) (*EpochRecord, error) {
	recordJSON, err := ctx.GetStub().GetState(epochID)
	if err != nil {
		return nil, fmt.Errorf("failed to read from ledger: %v", err)
	}
	if recordJSON == nil {
		return nil, fmt.Errorf("no record found for epoch %s", epochID)
	}

	var record EpochRecord
	err = json.Unmarshal(recordJSON, &record)
	if err != nil {
		return nil, err
	}

	return &record, nil
}

// EpochExists is a helper for internal validation
func (s *WardenAuditContract) EpochExists(ctx contractapi.TransactionContextInterface, epochID string) (bool, error) {
	recordJSON, err := ctx.GetStub().GetState(epochID)
	if err != nil {
		return false, err
	}
	return recordJSON != nil, nil
}

func main() {
	chaincode, err := contractapi.NewChaincode(&WardenAuditContract{})
	if err != nil {
		fmt.Printf("Error creating WardenAudit chaincode: %v", err)
		return
	}

	if err := chaincode.Start(); err != nil {
		fmt.Printf("Error starting WardenAudit chaincode: %v", err)
	}
}
