var j2c = (function () { 'use strict';

  var emptyArray = [];
  var emptyObject = {};
  var emptyString = '';
  var type = emptyObject.toString;
  var ARRAY =  type.call(emptyArray);
  var OBJECT = type.call(emptyObject);
  var STRING = type.call(emptyString);
  var FUNCTION = type.call(type);
  var own =  emptyObject.hasOwnProperty;
  /*/-inline-/*/
  // function cartesian(a, b, res, i, j) {
  //   res = [];
  //   for (j in b) if (own.call(b, j))
  //     for (i in a) if (own.call(a, i))
  //       res.push(a[i] + b[j]);
  //   return res;
  // }
  /*/-inline-/*/

  /* /-statements-/*/
  function cartesian(a,b, selectorP, res, i, j) {
    res = []
    for (j in b) if(own.call(b, j))
      for (i in a) if(own.call(a, i))
        res.push(concat(a[i], b[j], selectorP))
    return res
  }

  function concat(a, b, selectorP) {
    // `b.replace(/&/g, a)` is never falsy, since the
    // 'a' of cartesian can't be the empty string
    // in selector mode.
    return selectorP && (
      /^[-\w$]+$/.test(b) && ':-error-bad-sub-selector-' + b ||
      /&/.test(b) && /* never falsy */ b.replace(/&/g, a)
    ) || a + b
  }

  // "Tokenizes" the selectors into parts relevant for the next function.
  // Strings and comments are matched, but ignored afterwards.
  // This is not a full tokenizers. It only recognizes comas, parentheses,
  // strings and comments.
  // regexp generated by scripts/regexps.js then trimmed by hand
  var selectorTokenizer =  /[(),]|"(?:\\.|[^"\n])*"|'(?:\\.|[^'\n])*'|\/\*[\s\S]*?\*\//g

  /**
   * This will split a coma-separated selector list into individual selectors,
   * ignoring comas in strings, comments and in :pseudo-selectors(parameter, lists).
   * @param {string} selector
   * @return {string[]}
   */

  function splitSelector(selector) {
    var indices = [], res = [], inParen = 0, match, i
    /*eslint-disable no-cond-assign*/
    while(match = selectorTokenizer.exec(selector)) {
    /*eslint-enable no-cond-assign*/
      switch(match[0]){
      case '(': inParen++; break
      case ')': inParen--; break
      case ',': if (inParen) break; indices.push(match.index)
      }
    }
    for (i = indices.length; i--;){
      res.unshift(selector.slice(indices[i] + 1))
      selector = selector.slice(0, indices[i])
    }
    res.unshift(selector)
    return res
  }
  /* /-statements-/*/
  function flatIter (f) {
    return function iter(arg) {
      if (type.call(arg) === ARRAY) for (var i= 0 ; i < arg.length; i ++) iter(arg[i])
      else f(arg)
    }
  }

  function decamelize(match) {
    return '-' + match.toLowerCase()
  }

  /**
   * Handles the property:value; pairs.
   *
   * @param {array|object|string} o - the declarations.
   * @param {string[]} buf - the buffer in which the final style sheet is built.
   * @param {string} prefix - the current property or a prefix in case of nested
   *                          sub-properties.
   * @param {boolean} local - are we in @local or in @global scope.
   * @param {object} state - helper functions to populate or create the @local namespace
   *                      and to @extend classes.
   * @param {function} state.e - @extend helper.
   * @param {function} state.l - @local helper.
   */

  function declarations(o, buf, prefix, local, state) {
    var k, v, kk
    if (o==null) return
    if (/\$/.test(prefix)) {
      for (kk in (prefix = prefix.split('$'))) if (own.call(prefix, kk)) {
        declarations(o, buf, prefix[kk], local, state)
      }
      return
    }
    switch ( type.call(o = o.valueOf()) ) {
    case ARRAY:
      for (k = 0; k < o.length; k++)
        declarations(o[k], buf, prefix, local, state)
      break
    case OBJECT:
      // prefix is falsy iif it is the empty string, which means we're at the root
      // of the declarations list.
      prefix = (prefix && prefix + '-')
      for (k in o) if (own.call(o, k)){
        v = o[k]
        if (/\$/.test(k)) {
          for (kk in (k = k.split('$'))) if (own.call(k, kk))
            declarations(v, buf, prefix + k[kk], local, state)
        } else {
          declarations(v, buf, prefix + k, local, state)
        }
      }
      break
    default:
      // prefix is falsy when it is "", which means that we're
      // at the top level.
      // `o` is then treated as a `property:value` pair.
      // otherwise, `prefix` is the property name, and
      // `o` is the value.
      k = prefix.replace(/_/g, '-').replace(/[A-Z]/g, decamelize)

      if (local && (k == 'animation-name' || k == 'animation' || k == 'list-style')) {
        o = o.split(',').map(function (o) {
          return o.replace(/:?global\(\s*([-\w]+)\s*\)|()([-\w]+)/, state.l)
        }).join(',')
      }
      // '@' in properties also triggers the *ielte7 hack
      // Since plugins dispatch on the /^@/ for at-rules
      // we swap the at for an asterisk
      // http://browserhacks.com/#hack-6d49e92634f26ae6d6e46b3ebc10019a
      k = k.replace(/^@/, '*')

      buf.d(k, k ? ':': '', o, ';\n')

    }
  }

  /**
   * Hanldes at-rules
   *
   * @param {string} k - The at-rule name, and, if takes both parameters and a
   *                     block, the parameters.
   * @param {string[]} buf - the buffer in which the final style sheet is built
   * @param {string[]} v - Either parameters for block-less rules or their block
   *                       for the others.
   * @param {string} prefix - the current selector or a prefix in case of nested rules
   * @param {string} composes - the potential target of a @composes rule, if any
   * @param {boolean} local - are we in @local or in @global scope?
   * @param {object} state - helper functions to populate or create the @local namespace
   *                      and to @extend classes
   * @param {function} state.e - @extend helper
   * @param {function} state.l - @local helper
   */

  function at(k, v, buf, prefix, composes, local, state){
    var i, params
    if (/^@global$/.test(k)) {
      sheet(v, buf, prefix, 1, 0, state)

    } else if (/^@local$/.test(k)) {
      sheet(v, buf, prefix, 1, 1, state)

    } else if (/^@composes$/.test(k)) {
      if (!local) {
        buf.a('@-error-at-composes-in-at-global', '', '', ';\n')
        return
      }
      if (!composes) {
        buf.a('@-error-at-composes-no-nesting', '', '', ';\n')
        return
      }
      composes = splitSelector(composes)
      for(i = 0; i < composes.length; i++) {
        k = /^\s*\.(\w+)\s*$/.exec(composes[i])
        if (k == null) {
          // the last class is a :global(.one)
          buf.a('@-error-at-composes-bad-target', ' ', JSON.stringify(composes[i]), ';\n')
          continue
        }
        state.c(
          type.call(v) == ARRAY ? v.map(function (parent) {
            return parent.replace(/:?global\(\s*\.?([-\w]+)\s*\)|()\.([-\w]+)/, state.l)
          }).join(' ') : v.replace(/:?global\(\s*\.?([-\w]+)\s*\)|()\.([-\w]+)/, state.l),
          k[1]
        )
      }

    } else if (/^@(?:-[\w]+-)?(?:namespace|import|charset)$/.test(k)) {
      flatIter(function(v) {
        buf.a(k, ' ', v, ';\n')
      })(v)

    } else if (/^@(?:-[\w]+-)?(?:font-face|viewport|swash|ornaments|annotation|stylistic|styleset|character-variant)$/.test(k)) {
      flatIter(function(v) {
        buf.a(k, '', '', ' {\n')
        declarations(v, buf, '', local, state)
        buf.c('}\n')
      })(v)

    } else if (/^@(?:-[\w]+-)?(?:media|supports|document|page|keyframes|counter-style|font-feature-values)\b\s*(.+)/.test(k)) {

      params = k.match(/^@(?:-[\w]+-)?(?:media|supports|document|page|keyframes|counter-style|font-feature-values)\b\s*(.+)/)[1]

      k = k.match(/^@(?:-[\w]+-)?(?:media|supports|document|page|keyframes|counter-style|font-feature-values)/)[0]

      if (local && /^@(?:-[\w]+-)?(?:keyframes|counter-style)/.test(k)) params = params.replace(
        // generated by script/regexps.js
        /:?global\(\s*([-\w]+)\s*\)|()([-\w]+)/,
        state.l
      )

      buf.a(k, ' ', params, ' {\n')
      if (/@(?:-[\w]+-)?(?:page|counter-style)/.test(k)) {
        declarations(v, buf, '', local, state)
      } else {
        sheet(v, buf, prefix, 1, local, state)
      }
      buf.c('}\n')

    } else {
      buf.a('@-error-unsupported-at-rule', ' ', JSON.stringify(k), ';\n')
    }
  }

  /**
   * Add rulesets and other CSS statements to the sheet.
   *
   * @param {array|string|object} statements - a source object or sub-object.
   * @param {string[]} buf - the buffer in which the final style sheet is built
   * @param {string} prefix - the current selector or a prefix in case of nested rules
   * @param {string} composes - the potential target of a @composes rule, if any
   * @param {boolean} local - are we in @local or in @global scope?
   * @param {object} state - helper functions to populate or create the @local namespace
   *                      and to @composes classes
   * @param {function} state.e - @composes helper
   * @param {function} state.l - @local helper
   */
  function sheet(statements, buf, prefix, composes, local, state) {
    var k, v, inDeclaration

    switch (type.call(statements)) {

    case ARRAY:
      for (k = 0; k < statements.length; k++)
        sheet(statements[k], buf, prefix, composes, local, state)
      break

    case OBJECT:
      for (k in statements) {
        v = statements[k]
        if (prefix && /^[-\w$]+$/.test(k)) {
          if (!inDeclaration) {
            inDeclaration = 1
            buf.s(( prefix || '*' ), ' {\n')
          }
          declarations(v, buf, k, local, state)
        } else if (/^@/.test(k)) {
          // Handle At-rules
          inDeclaration = (inDeclaration && buf.c('}\n') && 0)

          at(k, v, buf, prefix, composes, local, state)

        } else {
          // selector or nested sub-selectors

          inDeclaration = (inDeclaration && buf.c('}\n') && 0)

          sheet(v, buf,
            (/,/.test(prefix) || prefix && /,/.test(k)) ?
              cartesian(splitSelector(prefix), splitSelector( local ?
                k.replace(
                  /:global\(\s*(\.[-\w]+)\s*\)|(\.)([-\w]+)/g, state.l
                ) : k
              ), prefix).join(',') :
              concat(prefix, ( local ?
                k.replace(
                  /:global\(\s*(\.[-\w]+)\s*\)|(\.)([-\w]+)/g, state.l
                ) : k
              ), prefix),
            composes || prefix ? '' : k,
            local, state
          )
        }
      }
      if (inDeclaration) buf.c('}\n')
      break
    case STRING:
      buf.s(
          ( prefix || ':-error-no-selector' ) , ' {\n'
        )
      declarations(statements, buf, '', local, state)
      buf.c('}\n')
    }
  }

  function j2c() {
    var filters = []
    var postprocessors = []
    var instance = {
      flatIter: flatIter,
      names: {},
      suffix: '__j2c-' +
        Math.floor(Math.random() * 0x100000000).toString(36) + '-' +
        Math.floor(Math.random() * 0x100000000).toString(36) + '-' +
        Math.floor(Math.random() * 0x100000000).toString(36) + '-' +
        Math.floor(Math.random() * 0x100000000).toString(36),
      use: function() {
        _use(emptyArray.slice.call(arguments))
        return instance
      }
    }

    var register = {
      $names: flatIter(function(ns) {
        for (var k in ns) if (!( k in instance.names )) instance.names[k] = ns[k]
      }),
      $filter: flatIter(function(filter) {
        filters.push(filter)
      }),
      $postprocess: flatIter(function(pp) {
        postprocessors.push(pp)
      })
    }

    var _use = flatIter(function(plugin) {
      if (type.call(plugin) === FUNCTION) plugin = plugin(instance)
      if (!plugin) return
      for (var k in plugin) if (own.call(plugin, k)) if (/^\$/.test(k)){
        if (k in register) register[k](plugin[k])
      } else if (!( k in instance )) instance[k] = plugin[k]

    })

    function makeBuf(inline) {
      var buf
      function push() {
        emptyArray.push.apply(buf.b, arguments)
      }
      buf = {
        b: [],   // buf
        a: push, // at-rules
        s: push, // selector
        d: push, // declaration
        c: push  // close
      }
      for (var i = 0; i < filters.length; i++) buf = filters[i](buf, inline)
      return buf
    }

    function postprocess(buf, res, i) {
      for (i = 0; i< postprocessors.length; i++) buf = postprocessors[i](buf) || buf
      return buf.join('')
    }

    var state = {
      c: function composes(parent, child) {
        var nameList = instance.names[child]
        instance.names[child] =
          nameList.slice(0, nameList.lastIndexOf(' ') + 1) +
          parent + ' ' +
          nameList.slice(nameList.lastIndexOf(' ') + 1)
      },
      l: function localize(match, global, dot, name) {
        if (global) return global
        if (!instance.names[name]) instance.names[name] = name + instance.suffix
        return dot + instance.names[name].match(/\S+$/)
      }
    }

  /*/-statements-/*/
    instance.sheet = function(statements, buf) {
      sheet(
        statements, buf = makeBuf(false),
        '', '',     // prefix and rawPRefix
        1,          // local, by default
        state
      )
      buf = postprocess(buf.b)
      return buf
    }
  /*/-statements-/*/
    instance.inline = function (decl, buf) {
      declarations(
        decl,
        buf = makeBuf(true),
        '',         // prefix
        1,          //local
        state
      )
      return postprocess(buf.b)
    }

    return instance
  }

  var _j2c = j2c()
  'sheet|sheets|inline|remove|names|flatIter'.split('|').map(function(m){j2c[m] = _j2c[m]})

  return j2c;

})();