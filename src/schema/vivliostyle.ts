import { createRequire } from 'node:module';

// TODO: Change to static import after JSON module becomes stable
const require = createRequire(import.meta.url);

const vivliostyleConfigSchema = require('../../schemas/vivliostyle/vivliostyleConfig.schema.json');

export { vivliostyleConfigSchema };
