# Swaram Team Workflow & Contribution Guide

This guide ensures that our four-person team can develop their assigned modules in parallel without collisions or merge conflicts.

---

## 🌿 Git Branching Strategy

```
main (Protected / Stable Integration)
  ├── feature/mobile-shell         -> Member 1 (Lead)
  ├── feature/voice-intelligence   -> Member 2
  ├── feature/backend-ocr-sync     -> Member 3
  └── feature/reporting-priority   -> Member 4
```

### Golden Rules:
1. **Never push directly to `main`:** All work must happen on your assigned feature branch.
2. **Stay inside your module folder:**  
   - Member 1 works in `module1-mobile/`  
   - Member 2 works in `module2-voice-intelligence/`  
   - Member 3 works in `module3-backend-ocr-ledger/`  
   - Member 4 works in `module4-reporting-priorities/`
3. **Do not modify `contracts/` unilaterally:** If an interface must change, all 4 teammates must convene and agree before updating schemas in `contracts/`.
4. **Never commit `.env` or secrets:** Check git status before committing (`git status`).
5. **Keep PRs self-contained:** When opening a Pull Request into `main`, describe:
   - What changed in your module
   - How to test it with `curl` or UI
   - Screenshots/terminal logs
   - Any known limitations or mock dependencies
