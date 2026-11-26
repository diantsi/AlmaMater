# Coverage Audit and Bug-Finding Prompt — 26.11.2026

1. Review the existing tests and testing-strategy.md. Map user stories to happy paths, edge cases, validation, and forbidden actions; distinguish actual checks from claimed coverage.
2. Pay particular attention to converting Europe/Kyiv datetime-local to ISO: calendar overflow, nonexistent DST hours, and adjacent valid values. Check whether the URL parser accepts incomplete HTTPS links that the form then submits without normalization.
3. For each confirmed defect, first add a regression test and run it against the old code. Do not mock the logic being tested; expectations must be specific and independent of the implementation. Add positive boundary cases.
4. Make minimal code fixes, run make check, and record the actual results. Run commands through the Makefile. Do not weaken authentication for testing purposes.
5. Open the application in a browser. Personally complete a short smoke checklist; separately mark passed, blocked, and not executed steps. Do not substitute code review or API tests for manual testing.
6. Prepare docs/testing-report.md: covered stories/scenarios, manual checklist, 2–3 real defects with reproduction steps and fixes,
