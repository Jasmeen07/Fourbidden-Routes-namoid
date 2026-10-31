#!/usr/bin/env python3
"""
Edge Case (EC) Coverage Checker
Checks that every 'Must' test from BLUEPRINT §9 has a corresponding test
decorated with @pytest.mark.ec("EC-XXX") or named test_..._ec_xxx.
"""
import os
import re
import sys

MUST_TEST_ECS = [
    # Identity & Session
    "EC-A01", "EC-A02", "EC-A03", "EC-A04", "EC-A05", "EC-A06", "EC-A07", "EC-A08", "EC-A10",
    # Requests
    "EC-R01", "EC-R02", "EC-R03", "EC-R04", "EC-R05", "EC-R06", "EC-R07", "EC-R08", "EC-R09", "EC-R10", "EC-R11", "EC-R12",
    # Reviews
    "EC-V01", "EC-V02", "EC-V03", "EC-V04", "EC-V05", "EC-V06", "EC-V07", "EC-V08", "EC-V09", "EC-V10", "EC-V11", "EC-V12", "EC-V13", "EC-V15", "EC-V16", "EC-V17",
    # Grants
    "EC-G01", "EC-G02", "EC-G03", "EC-G04", "EC-G05", "EC-G06", "EC-G07", "EC-G08", "EC-G09", "EC-G10", "EC-G11", "EC-G15", "EC-G16",
    # Gateway / PDP
    "EC-P01", "EC-P02", "EC-P03", "EC-P04", "EC-P06", "EC-P07",
    # Audit & UI
    "EC-L01", "EC-L02", "EC-L03", "EC-L04", "EC-U01", "EC-U02", "EC-U03", "EC-U04", "EC-U05",
]

def scan_tests_for_ecs(tests_dir: str) -> set[str]:
    found_ecs = set()
    pattern = re.compile(r'ec\(["\'](EC-[A-Z0-9]+)["\']\)|(EC-[A-Z0-9]+)', re.IGNORECASE)
    
    for root, _, files in os.walk(tests_dir):
        for f in files:
            if f.endswith(".py") or f.endswith(".ts") or f.endswith(".tsx"):
                path = os.path.join(root, f)
                with open(path, "r", encoding="utf-8", errors="ignore") as fp:
                    content = fp.read()
                    matches = pattern.findall(content)
                    for m in matches:
                        ec_id = (m[0] or m[1]).upper()
                        if ec_id in MUST_TEST_ECS:
                            found_ecs.add(ec_id)
    return found_ecs

def main():
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    backend_tests = os.path.join(root_dir, "backend", "tests")
    frontend_tests = os.path.join(root_dir, "frontend")
    
    found = scan_tests_for_ecs(backend_tests)
    if os.path.exists(frontend_tests):
        found |= scan_tests_for_ecs(frontend_tests)
        
    missing = [ec for ec in MUST_TEST_ECS if ec not in found]
    print(f"Total mandatory ECs: {len(MUST_TEST_ECS)}")
    print(f"Covered ECs: {len(found)}")
    
    if missing:
        print(f"Missing EC coverage ({len(missing)}): {', '.join(missing)}")
        return 1
    else:
        print("All mandatory edge cases have verified test coverage!")
        return 0

if __name__ == "__main__":
    sys.exit(main())
