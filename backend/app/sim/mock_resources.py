"""Mock models and datasets with canned synthetic outputs and MOCK watermark (BLUEPRINT §6.5, SAFE-1)."""
from typing import Any

MOCK_WATERMARK = "MOCK - SYNTHETIC DATA ONLY - APPROVAL RECORDS ACCOUNTABILITY, NOT USE SAFETY"

MOCK_OUTPUTS: dict[str, dict[str, Any]] = {
    "M-sentiment-v1": {
        "view_metadata": {
            "model_id": "M-sentiment-v1",
            "architecture": "DistilRoBERTa-v1-Mock",
            "classes": ["POSITIVE", "NEGATIVE", "NEUTRAL"],
            "accuracy_synthetic": 0.912,
            "watermark": MOCK_WATERMARK,
        },
        "query": {
            "prediction": "POSITIVE",
            "confidence": 0.942,
            "input_tokens": 14,
            "inference_time_ms": 12,
            "watermark": MOCK_WATERMARK,
        },
        "batch_query": {
            "batch_size": 3,
            "predictions": [
                {"text_id": 1, "label": "POSITIVE", "score": 0.88},
                {"text_id": 2, "label": "NEUTRAL", "score": 0.74},
                {"text_id": 3, "label": "NEGATIVE", "score": 0.95},
            ],
            "watermark": MOCK_WATERMARK,
        },
    },
    "M-fraudscore-v2": {
        "query": {
            "account_id": "acc_synthetic_491",
            "fraud_score": 14,
            "risk_band": "LOW",
            "factors": ["normal_device_fingerprint", "domestic_ip", "velocity_within_bounds"],
            "watermark": MOCK_WATERMARK,
        },
        "batch_query": {
            "processed_count": 5,
            "flagged_suspicious": 0,
            "watermark": MOCK_WATERMARK,
        },
        "fine_tune_simulated": {
            "job_id": "mock_job_ft_9823",
            "status": "COMPLETED_SIMULATION",
            "epochs": 3,
            "final_loss": 0.124,
            "watermark": MOCK_WATERMARK,
        },
    },
    "D-customers-synth": {
        "read_sample": {
            "record_count": 3,
            "schema": ["customer_id", "tier", "monthly_spend_synth"],
            "rows": [
                ["C-001", "GOLD", 450.0],
                ["C-002", "SILVER", 120.5],
                ["C-003", "BRONZE", 35.0],
            ],
            "watermark": MOCK_WATERMARK,
        },
        "read_full": {
            "record_count": 10,
            "description": "Full synthetic customer cohort (mock)",
            "sample_id": "batch_synth_full_01",
            "watermark": MOCK_WATERMARK,
        },
        "export_masked": {
            "export_format": "CSV_MASKED",
            "columns": ["hash_id", "masked_name", "masked_spend"],
            "download_token": "mock-download-key-exp-4921",
            "watermark": MOCK_WATERMARK,
        },
    },
    "D-claims-synth": {
        "read_sample": {
            "claims": [
                {"claim_id": "CLM-101", "amount": 1250.0, "status": "APPROVED_SYNTH"},
                {"claim_id": "CLM-102", "amount": 8900.0, "status": "UNDER_REVIEW_SYNTH"},
            ],
            "watermark": MOCK_WATERMARK,
        },
        "read_full": {
            "claims_count": 50,
            "dataset_tier": "RESTRICTED_SYNTHETIC",
            "watermark": MOCK_WATERMARK,
        },
        "export_masked": {
            "download_url": "https://grantgate.local/mock/export/claims-masked.zip",
            "watermark": MOCK_WATERMARK,
        },
        "join_simulated": {
            "joined_records": 24,
            "join_keys": ["customer_id"],
            "watermark": MOCK_WATERMARK,
        },
    },
    "D-lexicon-public": {
        "read_sample": {
            "words": ["fairness", "bias", "parity", "robustness"],
            "watermark": MOCK_WATERMARK,
        },
        "read_full": {
            "words_count": 120,
            "version": "1.0-public",
            "watermark": MOCK_WATERMARK,
        },
    },
}


def execute_mock_resource_action(resource_id: str, action: str) -> dict[str, Any]:
    """Returns canned synthetic output with guaranteed MOCK watermark."""
    res_data = MOCK_OUTPUTS.get(resource_id, {})
    output = res_data.get(action, {
        "status": "SUCCESS_SIMULATION",
        "action": action,
        "resource_id": resource_id,
        "watermark": MOCK_WATERMARK,
    })
    return output
