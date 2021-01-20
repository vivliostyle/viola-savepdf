import shelljs from 'shelljs';
import path from 'upath';
import { getMergedConfig, maskConfig } from './commandUtil';

const configFiles = ['valid.1', 'valid.2', 'valid.3', 'invalid.1'] as const;
const configFilePath = configFiles.reduce(
  (p, v) => ({
    ...p,
    [v]: path.resolve(__dirname, `fixtures/config/${v}.config.js`),
  }),
  {} as { [k in typeof configFiles[number]]: string },
);

afterAll(() => {
  shelljs.rm('-f', path.resolve(__dirname, 'fixtures/config/.vs-*'));
});

it('parse vivliostyle config', async () => {
  const validConfig1 = await getMergedConfig(['-c', configFilePath['valid.1']]);
  maskConfig(validConfig1);
  expect(validConfig1).toMatchSnapshot('valid.1.config.js');

  const validConfig2 = await getMergedConfig(['-c', configFilePath['valid.2']]);
  maskConfig(validConfig2);
  expect(validConfig2).toMatchSnapshot('valid.2.config.js');

  const validConfig3 = await getMergedConfig(['-c', configFilePath['valid.3']]);
  maskConfig(validConfig3);
  expect(validConfig3).toMatchSnapshot('valid.3.config.js');
});

it('override option by CLI command', async () => {
  const config = await getMergedConfig([
    '-c',
    configFilePath['valid.1'],
    '-o',
    'yuno.pdf',
    '-o',
    'yuno',
    '-f',
    'webbook',
    '-t',
    'https://myTheme.example.com',
    '-s',
    'JIS-B5',
    '--title',
    'myTitle',
    '--author',
    'myAuthor',
    '--language',
    'myLanguage',
    '--timeout',
    '42',
    '--executable-chromium',
    'myChromium',
  ]);
  maskConfig(config);
  expect(config).toMatchSnapshot('valid.1.config.js');
});

it('deny invalid config', () => {
  expect(
    getMergedConfig(['-c', configFilePath['invalid.1']]),
  ).rejects.toThrow();
});

it('Loads same config file on each way', async () => {
  const config1 = await getMergedConfig(['-c', configFilePath['valid.1']]);
  maskConfig(config1);
  const config2 = await getMergedConfig([configFilePath['valid.1']]);
  maskConfig(config2);
  expect(config1).toEqual(config2);
});

it('yields a config with single markdown', async () => {
  const config = await getMergedConfig([
    path.resolve(__dirname, 'fixtures/config/sample.md'),
  ]);
  maskConfig(config);
  expect(config.entries[0].target).toMatch(
    /^__WORKSPACE__\/tests\/fixtures\/config\/\.vs-.+\.sample\.html$/,
  );
  expect(config.manifestPath).toMatch(
    /^__WORKSPACE__\/tests\/fixtures\/config\/\.vs-.+\.manifest\.json$/,
  );
  const entryAlias = config.exportAliases.find(
    ({ source }) => source === config.entries[0].target,
  );
  expect(entryAlias?.target).toMatch(
    '__WORKSPACE__/tests/fixtures/config/sample.html',
  );
  const manifestAlias = config.exportAliases.find(
    ({ source }) => source === config.manifestPath,
  );
  expect(manifestAlias?.target).toMatch(
    '__WORKSPACE__/tests/fixtures/config/manifest.json',
  );
  config.manifestPath = '__SNIP__';
  config.entries[0].target = '__SNIP__';
  (config.exportAliases as unknown) = '__SNIP__';
  expect(config).toMatchSnapshot();
});

it('yields a config with single html', async () => {
  const config = await getMergedConfig([
    path.resolve(__dirname, 'fixtures/config/sample.html'),
  ]);
  maskConfig(config);
  expect(config.entries[0].target).toMatch(
    /^__WORKSPACE__\/tests\/fixtures\/config\/\.vs-.+\.sample\.html$/,
  );
  expect(config.manifestPath).toMatch(
    /^__WORKSPACE__\/tests\/fixtures\/config\/\.vs-.+\.manifest\.json$/,
  );
  config.manifestPath = '__SNIP__';
  config.entries[0].target = '__SNIP__';
  (config.exportAliases as unknown) = '__SNIP__';
  expect(config).toMatchSnapshot();
});

it('yields a config with single input and vivliostyle config', async () => {
  const config = await getMergedConfig([
    path.resolve(__dirname, 'fixtures/config/sample.md'),
    '-c',
    configFilePath['valid.1'],
  ]);
  maskConfig(config);
  expect(config.entries[0].target).toMatch(
    /^__WORKSPACE__\/tests\/fixtures\/config\/\.vs-.+\.sample\.html$/,
  );
  expect(config.manifestPath).toMatch(
    /^__WORKSPACE__\/tests\/fixtures\/config\/\.vs-.+\.manifest\.json$/,
  );
  config.manifestPath = '__SNIP__';
  config.entries[0].target = '__SNIP__';
  (config.exportAliases as unknown) = '__SNIP__';
  expect(config).toMatchSnapshot();
});
