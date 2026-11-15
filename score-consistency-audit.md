# Score consistency check

Rule: marks saved for a pupil, subject, session and term must remain available in both entry views and later reports; publishing must not erase them. Unsaved device drafts must not masquerade as published results.

| Place checked | Result |
| --- | --- |
| Individual entry, general broadsheet, auto-save, manual save, device drafts, AI sheet staging | Shared class read and migrated shared drafts; switching views saves when auto-save is enabled. Saved individual cells are removed from drafts without erasing siblings. |
| Class submission monitoring, approval, return/unapprove | Shares paginated assessment reads; mutations refresh all score-derived views. Existing approval permissions unchanged. |
| Publish class reports | Reads all assessment pages, rejects unsaved device marks and unapproved records; never deletes assessments. Read errors cannot appear as missing scores. |
| Report-card list, student profile result history, CSV export | Read persisted report cards. Refreshed after publishing; historical records unchanged. |
| Staff report details, four sheet designs, multilingual and Islamiyya reports | Read existing assessments for report student/session/term. Failed score reads now show an error instead of a blank sheet. |
| Single/class/bulk PDF, ZIP, print and WhatsApp report distribution | Use the same report detail data and saved renderer; distribution remains published-only. No existing delivery records changed. |
| Parent report list/detail, scratch-card access, parent printing | Published-only list and existing shared assessment rows; errors are reported rather than an empty list. PIN detail cache is intentionally not auto-refetched, preserving paid views. |
| QR verification and verify-credential fallback | Published report totals retained; public verification and existing permissions unchanged. |
| Position ranking preview and report_subject_positions database function | Read existing assessments, not a separate score store. Ranking preview now invalidates on score changes; authorized database subject ranks remain approved-only. |
| Dashboard and performance analytics | Dashboard reads persisted assessments. Performance read now school-scoped; score changes refresh both. Existing example/benchmark configuration was not changed. |
| AI student performance summary | Uses stored total and grade; score-read failure is no longer treated as no scores. |
| Friday performance preview/send assembly | Reads existing assessments; a read failure stops generation rather than reporting missing marks. Existing sent messages and example data untouched. No separate scheduled score-writing job found. |
| Yearly summary and promotion | Yearly summary reads persisted term reports and is refreshed after publishing; promotion does not erase assessments. |
| compute_grade and protect_assessment_approval database functions | Calculate persisted totals and enforce existing approval locking; no entry-mode-specific storage. Unchanged. |
| Scratch-card redemption and report verification database functions | Reference existing report cards, not a second score store. Prices, views, settings and permissions unchanged. |

Verification: signed in as the requesting administrator; a real PRIMARY TWO mark (15) appeared in both modes and after reload without changing pupil data. Existing published JSS 1 marks remained visible in individual entry. Shared-draft and cross-screen refresh tests cover migration, subject preservation and avoiding paid-view refetches. Actual new score submission, republishing, parent PIN redemption and message delivery were not executed, to avoid modifying live marks or consuming paid views/sending messages.