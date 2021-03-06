// jshint esversion: 9

const fs = require('fs-extra');
const sass = require('node-sass');
const cheerio = require('cheerio');
const { join, basename } = require('path');
const download_browser_scripts = require('./build-src/download_browser_scripts');
const index_generated_pages = require('./build-src/index_generated_pages');

const scripts = ['index', 'shake', 'search' /* The script file names to compile */];
const stylesheets = [ 'style', 'materialdesignicons', 'editor', 'index', 'select' /* The stylesheet file names to compile */ ];
const bid = Math.random().toString(16).replace(/[^a-z]+/g, '').substr(0, 12);

module.exports = function(grunt) {

  require('load-grunt-tasks')(grunt);

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    // Script configuration
    ts: {
      default : {
        tsconfig: './tsconfig.json'
      }
    },
    webpack: Object.fromEntries(((e => [
        ...e
          .map(e => [...e])
          .map(e => {
            e[0] += '-dev';
            e[1] = { ...e[1] };
            e[1].mode = 'development';
            return e;
          }),
        ...e
          .map(e => [...e])
          .map(e => {
            e[0] += '-prod';
            e[1] = { ...e[1] };
            e[1].mode = 'production';
            return e;
          }),
      ])(scripts.map(e => [`${e}`, {
        mode: 'production',
        entry: join(__dirname, `build/www-tmp/scripts/${e}.ts`),
        module: {
          rules: [
            {
              test: /\.tsx?$/,
              use: 'ts-loader',
              exclude: /node_modules/,
            },
          ],
        },
        resolve: {
          extensions: ['.tsx', '.ts', '.js'],
        },
        output: {
          path: join(__dirname, `build/www/scripts`),
          filename: `${e}.min.js`,
        },
        devtool: 'source-map',
    }])))),


    // Style Configuration
    sass: {
      options: {
        implementation: sass,
        sourceMap: true
      },
      dist: {
        files: Object.fromEntries(stylesheets.map(it => [
          `build/www-tmp/sass-dist/${it}.css`, `src/main/www/style/${it}.scss`
        ])),
      }
    },
    postcss: {
      options: {
        browsers: ['last 2 versions', 'ie 8', 'ie 9'],
        map: true,
        processors: [
          require('css-mqpacker')(),
          require('autoprefixer')(),
        ]
      },
      dev: {
        expand: true,
        cwd: 'build/www-tmp/sass-dist/',
        src: '**/*.css',
        dest: 'build/www/style/',
        ext: '.min.css'
      },
      prod: {
        options: {
          map: false
        },
        src: 'build/www-tmp/sass-dist/style.css',
        dest: 'build/www/style/style.min.css'
      }
    },

    'compile-handlebars': {
      allStatic: {
        files: [
          {
          expand: true,
          cwd: 'build/www-tmp/handlebars/',
          src: `**/*.hbs`,
          dest: `build/www/`,
          ext: '.html'
          },
          {
          expand: true,
          cwd: 'src/main/www/',
          src: [`**/*.hbs`, '!template.hbs'],
          dest: `build/www/`,
          ext: '.html'
          }
        ],
        templateData: {
          bid: bid
        },
        handlebars: 'node_modules/handlebars'
      },
    },

    markdown: {
      all: {
        files: [{
          expand: true,
          cwd: 'markdown/',
          src: `**/*.md`,
          dest: `build/www-tmp/handlebars/`,
          ext: '.hbs'
        }],
        options: {
          template: 'src/main/www/template.hbs',
          postCompile: (src) => {
            const $ = cheerio.load(src);
            $(Array.from(Array(6).keys()).map(e => `h${e+1}`).join(', ')).each(function() {
               $(`<a class='headline-link' href='#${$(this).attr('id')}'><i class='mdi mdi-link-variant'></i></a>`).appendTo($(this));
            });
            return $.html();
          },
          markdownOptions: {
            gfm: true,
            highlight: 'manual',
            codeLines: {
              before: '<span>',
              after: '</span>'
            }
          }
        }
      }
    },

    // Watch
    watch: {
      scripts: {
        files: 'src/main/www/scripts/**/*.ts',
        tasks: ['scripts-dev'],
        options: {
          debounceDelay: 250,
        },
      },
      style: {
        files: 'src/main/www/style/**/*.scss',
        tasks: ['style'],
        options: {
          debounceDelay: 250,
        },
      },
      html: {
        files: 'src/main/www/**/*.hbs',
        tasks: ['html-dev'],
        options: {
          debounceDelay: 250,
        },
      },
      html2: {
        files: 'markdown/**/*.md',
        tasks: ['html-dev'],
        options: {
          debounceDelay: 250,
        },
      },
      assets: {
        files: 'assets/**/*',
        tasks: ['assets'],
        options: {
          debounceDelay: 250,
        },
      }
    },

    browserSync: {
      bsFiles: {
        src : './build/www'
      },
      options: {
        watchTask: true,
        server: './build/www'
      }
    },

    clean: {
      html: ['build/www/**/*.html'],
      style: ['build/www/style/**/*.css'],
      scripts: ['build/www/scripts/**/*.js'],
      www: ['build/www'],
      'www-tmp': ['build/www-tmp'],
    },

    imagemin: {
      dynamic: {
        options: {
          optimizationLevel: 3,
          svgoPlugins: [{removeViewBox: false}],
        },
        files: [{
          expand: true,
          cwd: 'src/main/www/',
          src: ['assets/**/*.{png,jpg,gif,ico,svg}'],
          dest: 'build/www/'
        }]
      }
    },

    copy: {
      assets: {
        files: [{
          expand: true,
          cwd: 'src/main/www/',
          src: ['assets/**/*', '!assets/**/*.{png,jpg,gif,ico,svg}'],
          dest: 'build/www/'
        }],
      },
      materialdesignicons: {
        files: [{
          expand: true,
          cwd: 'node_modules/@mdi/font/fonts',
          src: '**/*',
          dest: 'build/www/assets/fonts/materialdesignicons'
        }],
      },
      scripts: {
        files: [{
          expand: true,
          cwd: 'src/main/www/scripts/',
          src: '**/*',
          dest: 'build/www-tmp/scripts/'
        }],
      }
    }
  });

  grunt.task.registerTask('browser-scripts', 'Task that downloads the production versions of shake for the code playground.', function() {

    const done = this.async();
    (async () => {

      await fs.mkdirs('build/www-tmp/scripts');
      const scripts = await download_browser_scripts('build/www-tmp/scripts/shake/');
      await fs.writeFile('build/www-tmp/scripts/shake-versions.json', JSON.stringify(scripts.map(e => ({
        commit: e.commit,
        file: basename(e.target).replace(/\\/g, '/')
      })), null, 2));
      done();

    })();

  });

  grunt.task.registerTask('search-index', 'Task that indexes html pages for the site search functionality', function() {

    const done = this.async();
    (async () => {

      await fs.mkdirs('build/www-tmp/scripts');
      const index = await index_generated_pages('build/www');
      await fs.writeFile('build/www-tmp/scripts/search-index.json', index.toJson());
      done();

    })();

  });

  grunt.loadNpmTasks('grunt-sass');
  grunt.loadNpmTasks('grunt-postcss');
  grunt.loadNpmTasks('grunt-ts');
  grunt.loadNpmTasks('grunt-compile-handlebars');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-browser-sync');
  grunt.loadNpmTasks('grunt-markdown');
  grunt.loadNpmTasks('grunt-contrib-imagemin');
  grunt.loadNpmTasks('grunt-contrib-copy');

  grunt.registerTask('style', ['sass', 'postcss']);
  grunt.registerTask('webpack-dev', scripts.map(e => `webpack:${e}-dev`));
  grunt.registerTask('webpack-prod', scripts.map(e => `webpack:${e}-prod`));
  grunt.registerTask('scripts-dev-small', ['copy:scripts', 'webpack-dev']);
  grunt.registerTask('scripts-dev', ['browser-scripts', 'scripts-dev-small']);
  grunt.registerTask('scripts-prod', ['browser-scripts', 'copy:scripts', 'webpack-prod']);

  grunt.registerTask('html-base', ['clean:html', 'markdown', 'compile-handlebars', 'search-index']);
  grunt.registerTask('html-dev', ['html-base', 'scripts-dev']);
  grunt.registerTask('html-prod', ['html-base', 'scripts-prod']);
  grunt.registerTask('watch-browser-sync', ['browserSync', 'watch']);
  grunt.registerTask('assets', ['imagemin', 'copy:assets', 'copy:materialdesignicons']);

  grunt.registerTask('all-dev', ['style', 'html-dev', 'assets']);
  grunt.registerTask('all-prod', ['style', 'html-prod', 'assets']);
  grunt.registerTask('dev', ['all-dev', 'watch-browser-sync']);
  grunt.registerTask('default', ['all-prod']);
  grunt.registerTask('build', ['all-prod']);

};

