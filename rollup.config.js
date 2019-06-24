import babel from 'rollup-plugin-babel';
import babelrc from 'babelrc-rollup';

export default {
  entry: 'src/version.js',
  dest: 'index.js',
  plugins: [babel(babelrc())],
};
