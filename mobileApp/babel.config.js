module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    './babel/lucide-deep-imports',
    [
      'module:react-native-dotenv',
      {
        moduleName: '@env',
        path: '.env',
        safe: false,
        allowUndefined: true,
      },
    ],
    [
      'module-resolver',
      {
        root: ['./src'],
        extensions: ['.js', '.jsx', '.json'],
        alias: {
          '@': './src',
        },
      },
    ],
  ],
};
