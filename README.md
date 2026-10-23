# Mirror AI — agent skills (marketplace)

Install for Cursor (or other agents supported by the Skills CLI):

```bash
npx skills add <your-github-user>/mirror-ai-skills@mirror-ai -g -y
```

After you publish this folder to GitHub, replace `<your-github-user>/mirror-ai-skills` with your repo.

## Publish to [skills.sh](https://skills.sh/)

1. Create a **public** GitHub repository (e.g. `mirror-ai-skills`).
2. Copy or symlink the `mirror-ai/` folder into that repo (this directory layout is what `npx skills add` expects).
3. Push to `main`.
4. Install locally to verify:

   ```bash
   npx skills add YOUR_USER/mirror-ai-skills@mirror-ai -g -y
   ```

5. Skills on **skills.sh** are indexed from public GitHub repos when users install them; there is no separate “submit” button — discovery grows as people install and search.

Optional: add a repo README with one-line description and link to the Mirror AI zip or main app repo.
