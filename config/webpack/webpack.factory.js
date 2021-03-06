/**
 * This files configures webpack for the given environment.
 */

// Node
const path = require('path');

// NPM
const webpack = require('webpack');
const autoprefixer = require('autoprefixer');
const glob = require('glob');

// Webpack Plugins
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const CommonsChunkPlugin = require("webpack/lib/optimize/CommonsChunkPlugin");
const Clean = require('clean-webpack-plugin');

/**
 * Regex used to indicate the libraries. Excludes:
 * * node_modules - modules loaded through npm
 * * bower_component - modules loaded through bower
 * * public - static files added to the project
 */
const libraries = /(node_modules|bower_components|public)/;

/* ***** HELPERS ***** */
const entryFiles = require('../lib/entryfiles');
const assign = require('../lib/assign');
const isObject = require('../lib/isObject');

/**
 * Function to take options to build the webpack configuration.
 * @param options can be expressed as either ...rest or individual arguments.
 */
module.exports = function makeWebPackConfig(/* options */) {

  const opts = assign({
    build: false,
    test: false,
    typescript: true,
    baseDir: path.normalize(__dirname + '/../..'),
    dist: {
      path: './dist',
      assets: './dist/assets'
    },
    server: {
      port: '4200'
    }
  }, Array.prototype.slice.call(arguments, 0));

  return {
    context: opts.baseDir,
    entry: entry(opts),
    output: output(opts),
    module: {
      loaders: loaders(opts),
      preLoaders: preLoaders(opts)
    },
    resolve: resolve(opts),
    devtool: devtool(opts),
    devServer: devServer(opts),
    plugins: plugins(opts),
    postcss: postcss(opts)
  };

};


/**
 * @see http://webpack.github.io/docs/configuration.html#entry
 * @see https://github.com/webpack/docs/wiki/optimization#multi-page-app
 */
 function entry(opts) {
   // Karma will set this during test build
   if(opts.test) { return {}; }

   const ext = opts.typescript ? '.ts' : '.js';
   const files = glob.sync('./client/**' + ext);
   //return [ './client/styles/app.scss', './client/app' + ext ];

   // Returns an object of file entry points that Webpack will compile into
   // different output files.  
   return files.reduce(entryFiles, {});
 }

/** @see http://webpack.github.io/docs/configuration.html#output */
function output(opts) {
  // Karma will set this during test build
  if(opts.test) { return {}; }

  return {
    path: path.resolve(opts.baseDir, opts.dist.assets),
    publicPath: '/assets/',
    //filename: opts.build ? '[name].[hash].js' : '[name].bundle.js'
    filename: '[name].js'
  };
}

/** @see http://webpack.github.io/docs/configuration.html#module-loaders */
function loaders(opts) {
  const loaders = [];

  if(opts.typescript) {
    /**
     * Compiles typescript files into ES6, then compiles ES6 to ES5 with Babel.
     * @see https://github.com/TypeStrong/ts-loader
     * @see https://github.com/babel/babel-loader
     */
    loaders.push({
      test: /\.tsx?$/,
      exclude: libraries,
      loaders: ['ng-annotate', 'babel', 'ts-loader']
    });
  }

  /**
   * Compiles ES6 JS into ES5.
   * @see https://github.com/babel/babel-loader
   */
  loaders.push({
    test: /\.js$/,
    exclude: libraries,
    loaders: ['ng-annotate', 'babel']
  });

  /**
   * Copy svg, woff, woff2, ttf, eot files to output
   * Rename the file using the asset hash
   * Pass along the updated reference to your code
   * You can add here any file extension you want to get copied to your output
   * @see https://github.com/webpack/file-loader
   */
  loaders.push({
    test: /\.(svg|woff|woff2|ttf|eot)$/,
    exclude: libraries,
    loader: 'file'
  });

  /**
   * Either copy png, jpg, jpeg, gif files to output or convert to data. If the
   * file is less than 8k, it will convert to data; otherwise, it will copy,
   * rename the file using the asset hash, and pass along the updated reference
   * to your code.
   * You can add here any file extension you want to get copied to your output
   * @see https://github.com/webpack/url-loader
   */
  loaders.push({
    test: /\.(png|jpg|jpeg|gif)$/,
    exclude: libraries,
    loader: 'url?limit=8192'
  });

  /**
   * Allow loading html through js.
   * @see https://github.com/webpack/html-loader
   * @see https://github.com/WearyMonkey/ngtemplate-loader
   */
  loaders.push({
    test: /\.html$/,
    exclude: libraries,
    // TBD Potentially need to test if Windows and adjust the path separators.
    // @see https://github.com/WearyMonkey/ngtemplate-loader#path-separators-or-using-on-windows
    loader: 'ngtemplate?relativeTo='+opts.baseDir+'!html'
  });

  /**
   * Pulls all files in the /public folder and puts it into the dist folder.
   * This is used in conjunction with the 'assets' entry.
   * @see https://github.com/webpack/file-loader
   */
  loaders.push({
    test: /public\/.*/,
    exclude: /(node_modules|bower_components|client)/,
    loader: 'file?name=../[path]/[name].[ext]&context=./public'
  });

  /**
  * Use style-loader in development for hot-loading.
  * @see https://github.com/webpack/style-loader
  */
  loaders.push({
    test: /\.scss$/,
    loader: ExtractTextPlugin.extract('style-loader', [
      'css-loader',
      'postcss-loader',
      'sass-loader?includePaths[]=' + path.resolve(opts.baseDir, './client/styles')
    ].join('!'))
  });

  return loaders;
}

/** @see http://webpack.github.io/docs/configuration.html#module-preloaders-module-postloaders */
function preLoaders(opts) {
  const preloaders = [];

  /**
   * Used with ng-template loader to preload template to be referenced in directives.
   * @see https://github.com/deepsweet/baggage-loader
   * @see https://github.com/WearyMonkey/ngtemplate-loader#baggage-example
   */
  preloaders.push({
    test: /\.[tj]sx?$/,
    exclude: libraries,
    loader: 'baggage?[file].html&[file].scss'
  });

  if(opts.test) {
    /**
     * ISPARTA LOADER
     * Instrument JS files with Isparta for subsequent code coverage reporting
     * Skips node_modules and files that end with .spec.js
     * @see https://github.com/ColCh/isparta-instrumenter-loader
     */
    /* FIXME This is not working
    preloaders.push({
      test: opts.typescript ? /\.[jt]sx?$/ : /\.jsx?$/,
      exclude: [
        libraries,
        opts.typescript ? /\.spec\.[jt]sx?$/ : /\.spec\.jsx?$/
      ],
      loader: opts.typescript ? 'isparta-instrumenter!babel!ts-loader' : 'isparta-instrumenter!babel'
    });
    */
  }

  return preloaders;
}

/** @see http://webpack.github.io/docs/configuration.html#resolve */
function resolve(opts) {
  const extensions = ['', '.webpack.js', '.web.js', '.js', '.scss'];
  if(opts.typescript) {
    extensions.push('.ts');
    extensions.push('.tsx');
  }

  return {
    extensions: extensions
  };
}

/** @see http://webpack.github.io/docs/configuration.html#devtool */
function devtool(opts) {
  if(opts.test) { return 'inline-source-map'; }

  return opts.build ? 'source-map' : 'eval';
}

/** @see http://webpack.github.io/docs/configuration.html#devserver */
function devServer(opts) {
  const server = {
    port: opts.server.port,
    contentBase: './public',
    stats: {
      modules: false,
      cached: false,
      colors: true,
      chunk: false
    }
  };

  if(isObject(opts.server.proxy)) {
    server.proxy = {};
    server.proxy[opts.server.proxy.path] = {
      target: opts.server.proxy,
      secure: false
    };
  }
  return server;
}

/** @see http://webpack.github.io/docs/configuration.html#plugins */
function plugins(opts) {
  const plugins = [];

  /**
   * Extract css files
   * @see https://github.com/webpack/extract-text-webpack-plugin
   */
  plugins.push(new ExtractTextPlugin('[name].css', {
    disable: !opts.build || opts.test
  }));

  if(opts.build) {

    /**
     * Cleans the dist folder before building.
     * @see https://github.com/johnagan/clean-webpack-plugin
     */
    plugins.push(new Clean([ opts.dist.path ], opts.baseDir));

    /**
     * Identifies common modules and put them into a commons chunk
     * @see https://github.com/webpack/docs/wiki/optimization#multi-page-app
     */
    plugins.push(new CommonsChunkPlugin('commons', 'commons.js'));

    /**
     * Only emit files when there are no errors
     * @see http://webpack.github.io/docs/list-of-plugins.html#noerrorsplugin
     */
    plugins.push(new webpack.NoErrorsPlugin());

    /**
     * Dedupe modules in the output
     * @see http://webpack.github.io/docs/list-of-plugins.html#dedupeplugin
     */
    plugins.push(new webpack.optimize.DedupePlugin());

    /**
     * Minify all javascript, switch loaders to minimizing mode
     * @see http://webpack.github.io/docs/list-of-plugins.html#uglifyjsplugin
     */
    plugins.push(new webpack.optimize.UglifyJsPlugin({
      compress: {
        warnings: false
      }
    }));

  }

  /**
    * Assign the module and chunk ids by occurrence count. Ids that are used
    * often get lower (shorter) ids. This make ids predictable, reduces to
    * total file size and is recommended.
    * @see http://webpack.github.io/docs/list-of-plugins.html#occurenceorderplugin
    */
  plugins.push(new webpack.optimize.OccurenceOrderPlugin());

  return plugins;
}

/** @see */
function postcss(opts) {
  return [

    /**
     * Add vendor prefixes to your css
     * @see https://github.com/postcss/autoprefixer-core
     */
    autoprefixer({
      browsers: ['last 2 versions']
    })

  ];
}
