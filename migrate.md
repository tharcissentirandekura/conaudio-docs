# Migration Notes Archive

This page preserves older planning notes.

Use [Migrations](/migrations/) as the primary entry point for current migration documentation, and use [Database HTTP API](/migrations/db/) plus [Server migration](/migrations/server) for contract-level migration work.

---

## Legacy notes (archived)

### 1. Schemas migration (`server/app/schemas` to `specs/schemas`)
Target: move to `specs/schemas` and convert from JavaScript to YAML format.

Current issues:

JavaScript schemas using require() and tv4 validation
Need to convert to OpenAPI YAML format
Root schema structure needs to be integrated with existing OpenAPI spec
Migration steps:

# Convert JavaScript schemas to YAML format
# Integrate with existing specs/schemas structure
# Update references in OpenAPI spec
### 2. Models migration (`server/app/models` to `server/server/models`)
Target: consolidate with existing `server/server/models`.

Current issues:

Duplicate model definitions (Concert exists in both places)
Uses Backbone.js patterns (outdated)
Mixed ES6 classes and CommonJS modules
Dependencies on collections and lib
### 3. Collections migration (`server/app/collections`)
Target: convert to modern data access patterns.

Current issues:

Uses Backbone Collection pattern (outdated)
Should be replaced with modern query builders or repository patterns
Dependencies on models
### 4. Lib migration (`server/app/lib` to `saflib` or `server/server/lib`)
Target: move shared utilities to appropriate locations.

Current issues:

BaseClass.js and Model.js use Backbone (outdated)
Some utilities could go to saflib for reuse
Others are server-specific and should stay in server/server/lib
## Detailed migration plan

### Phase 1: Schemas migration
# 1. Convert JavaScript schemas to YAML
# 2. Move to specs/schemas/
# 3. Update OpenAPI references
Action items:

Convert server/app/schemas/models/*.js to YAML format in specs/schemas/
Convert server/app/schemas/common/*.js to YAML format in specs/schemas/
Update specs/openapi.yaml to reference new schemas
Remove JavaScript schema validation (tv4) dependencies
### Phase 2: Models consolidation
# 1. Merge duplicate models
# 2. Modernize Backbone patterns
# 3. Update to use Mongoose properly
Action items:

Compare server/app/models/ with server/server/models/
Merge and modernize duplicate models
Convert Backbone patterns to modern Mongoose patterns
Update imports and dependencies
### Phase 3: Collections removal
# 1. Replace Backbone Collections with modern patterns
# 2. Create repository or service layer
# 3. Update dependent code
Action items:

Replace Collection pattern with modern query builders
Create service layer for data access
Update route handlers to use new patterns
### Phase 4: Lib migration
# 1. Move reusable utilities to saflib
# 2. Move server-specific utilities to server/server/lib
# 3. Remove outdated patterns
Action items:

Move generic utilities to saflib/utils/
Move server-specific utilities to server/server/lib/
Remove Backbone dependencies
Update all imports
## Immediate next steps

- Start with schemas. This has the least dependencies and largest contract impact.
- Create a migration branch for isolated parity work.
- Update one model at a time to reduce regressions.
- Test each migration step before moving to the next.