"""Export OpenAPI JSON specification from FastAPI app (BLUEPRINT §15.1)."""
import os
import sys
import json

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.main import create_app


def export_openapi():
    app = create_app()
    openapi_schema = app.openapi()
    output_path = os.path.join(os.path.dirname(__file__), "..", "backend", "openapi.json")
    with open(output_path, "w", encoding="utf-8") as fp:
        json.dump(openapi_schema, fp, indent=2)
    print(f"OpenAPI schema exported to {output_path}")


if __name__ == "__main__":
    export_openapi()
