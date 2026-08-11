# i18n automation

This branch contains scripts and a codemod to help extract hardcoded Vietnamese strings and replace them with i18next keys.

Files added:
- scripts/normalize-locales.js      -> normalizes public/locales/vi.json to vi.normalized.json and mapping
- scripts/extract-vi-strings.js    -> scans source files and generates i18n-replacements.json
- scripts/extract-vi-strings-debug.js -> debug scanner to inspect matches
- codemods/replace-with-i18n-ast-i18next.js -> jscodeshift codemod for React + react-i18next

Quick run (local):

1) Install dev deps:
   npm install --save-dev jscodeshift glob

2) Normalize locales
   node scripts/normalize-locales.js public/locales/vi.json

3) Extract strings
   node scripts/extract-vi-strings.js

4) Preview codemod for a single file (dry-run):
   npx jscodeshift -t codemods/replace-with-i18n-ast-i18next.js src/pages/saas/SaaSSuppliersPage.tsx --extensions=ts,tsx --parser=tsx -d -p -- -replacements=i18n-replacements.json

5) Apply codemod to folder (after review):
   npx jscodeshift -t codemods/replace-with-i18n-ast-i18next.js src --extensions=ts,tsx --parser=tsx -- -replacements=i18n-replacements.json

Notes:
- Review i18n-replacements.json before applying codemod. The codemod assumes react-i18next and will insert useTranslation() and call t('key', { params }).
- Make a branch & commit/backup before running.
