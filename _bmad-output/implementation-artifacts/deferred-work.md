- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-chunks-from-markdown.md`
  summary: In non-travel files, a top "# Title" heading is read as region when items look like "## Name, Place".
  evidence: placeMeta takes region from headingPath[0]; workaround is a .meta.json with placeHeadings:false. Revisit when the first education/business file arrives.
