# AdSense readiness

Checked against current official Google guidance on 2026-08-27.

## Implemented before applying

- Original, substantial organizer content: guide hub, clan-bingo playbook, custom-maker guide, tracking/privacy guide, and a generated public library of the product's editable presets.
- Clear navigation on desktop and mobile plus a full footer.
- About, FAQ, privacy, terms, and contact/support pages.
- Static sitemap and crawl rules. Private bearer-link workflows are excluded from crawling; dynamic public event pages use `noindex` so search focuses on maintained editorial pages.
- Canonical metadata, social metadata, descriptive titles, and structured data for the application and FAQ.
- No fake AdSense code, publisher ID, `ads.txt`, analytics cookie, or consent banner.

Google's own readiness guidance emphasizes unique content, useful navigation, and sufficient finished text:

- https://support.google.com/adsense/answer/7299563
- https://support.google.com/adsense/answer/81904
- https://support.google.com/adsense/answer/48182

## Needs owner/account input

1. Choose and connect a memorable custom domain. The current Sites URL is functional and its HTML is controllable, but a first-party domain is better for brand ownership and durable search discovery.
2. Create or connect the AdSense account and provide the real `ca-pub-...` publisher ID. Site ownership is verified by code placed in the HTML: https://support.google.com/adsense/answer/91205
3. Add the real AdSense verification tag only after the publisher ID is known.
4. After approval, add the exact `ads.txt` line supplied by AdSense. Never use a placeholder ID; an incorrect declaration prevents Google demand: https://support.google.com/adsense/answer/9785052
5. Configure Google's Privacy & messaging CMP (or another Google-certified CMP) before serving personalized ads to the EEA, UK, or Switzerland: https://support.google.com/adsense/answer/13554116
6. Update the privacy page with Google advertising-cookie disclosures before ad code is activated: https://support.google.com/adsense/answer/1348695

## Placement policy for the first ad release

- Allow ads only on maintained content pages: `/guides/*`, `/presets`, `/about`, and possibly the public `/bingo` explainer.
- Do not place ads in private captain, participant, organizer, team, pairing, evidence, or dashboard workflows.
- Do not style ads like gold/scroll action buttons or place them where they can be mistaken for navigation.
- Do not ask users to click ads or imply that clicking supports a team/event.
- Start with one responsive slot after the first substantial section and one near the end of long guides. Measure layout shift and mobile readability before adding more.

## Launch sequence

1. Connect custom domain and Search Console.
2. Submit `/sitemap.xml` and verify the editorial pages render without authentication.
3. Accumulate genuine clan-organizer use and improve guides from support questions.
4. Apply to AdSense with the live domain.
5. Add verification code and account-supplied `ads.txt`.
6. Configure certified consent messaging and update privacy disclosures.
7. Add conservative content-page ad slots behind one environment-controlled publisher configuration.
