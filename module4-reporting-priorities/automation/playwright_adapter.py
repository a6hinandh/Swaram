"""
Playwright Form Automation Adapter
Fills government portal fields using accessible user-facing locators (getByLabel / getByRole).
Maintains an explicit confirmation gate immediately before submission.
"""

from typing import Dict, Any
import os

class PlaywrightFormAdapter:
    def __init__(self, portal_url: str = None):
        self.portal_url = portal_url or os.getenv("MOCK_PORTAL_URL", "http://localhost:8080")

    async def fill_form(self, mapped_fields: Dict[str, Any], auto_submit: bool = False) -> Dict[str, Any]:
        """
        Launches Playwright, navigates to the portal, fills fields via accessible locators,
        and pauses at the human-confirmation gate before submitting.
        """
        try:
            from playwright.async_api import async_playwright
        except ImportError:
            return {
                "status": "playwright_not_installed",
                "message": "Playwright is not installed. To run real browser automation, run: pip install playwright && playwright install"
            }

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=os.getenv("HEADLESS_BROWSER", "true") == "true")
            page = await browser.new_page()
            await page.goto(self.portal_url)

            # Use resilient accessible locators
            if mapped_fields.get("beneficiary_name"):
                await page.get_by_label("Beneficiary Name").fill(str(mapped_fields["beneficiary_name"]))
            
            if mapped_fields.get("gestational_weeks"):
                await page.get_by_label("Gestational Age (Weeks)").fill(str(mapped_fields["gestational_weeks"]))

            if mapped_fields.get("systolic_bp"):
                await page.get_by_label("Systolic Blood Pressure (mmHg)").fill(str(mapped_fields["systolic_bp"]))

            if mapped_fields.get("diastolic_bp"):
                await page.get_by_label("Diastolic Blood Pressure (mmHg)").fill(str(mapped_fields["diastolic_bp"]))

            if mapped_fields.get("ifa_tablets"):
                await page.get_by_label("Iron Folic Acid (IFA) Tablets Distributed").select_option(str(mapped_fields["ifa_tablets"]))

            if mapped_fields.get("follow_up_date"):
                await page.get_by_label("Next Scheduled Visit Date").fill(str(mapped_fields["follow_up_date"]))

            # Pre-submit Confirmation Gate
            if not auto_submit:
                await browser.close()
                return {
                    "status": "form_prepared_awaiting_confirmation",
                    "mapped_fields": mapped_fields,
                    "portal": self.portal_url,
                    "message": "Form populated successfully. Awaiting explicit worker confirmation before final submission."
                }

            # Submit form
            await page.get_by_role("button", name="Submit Record").click()
            await page.wait_for_timeout(1000)
            await browser.close()

            return {
                "status": "success",
                "message": "Form submitted successfully via Playwright adapter.",
                "portal": self.portal_url
            }

playwright_adapter = PlaywrightFormAdapter()
