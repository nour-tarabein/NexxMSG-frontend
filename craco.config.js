const path = require('path');

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      webpackConfig.resolve.fallback = {
        ...webpackConfig.resolve.fallback,
        fs: false,                            
        path: require.resolve('path-browserify'),  
      };
      return webpackConfig;
    },
  },
};