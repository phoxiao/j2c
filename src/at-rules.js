import {type, ARRAY, splitSelector, flatIter} from './helpers'
import {sheet} from './sheet'
import {declarations} from './declarations'

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

export function at(k, v, buf, prefix, composes, local, state){
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

  } else if (/^@(?:-[\w]+-)?(?:media|supports|document|page|keyframes|font-feature-values)\b\s*(.+)/.test(k)) {

    params = k.match(/^@(?:-[\w]+-)?(?:media|supports|document|page|keyframes|font-feature-values)\b\s*(.+)/)[1]

    k = k.match(/^@(?:-[\w]+-)?(?:media|supports|document|page|keyframes|font-feature-values)/)[0]

    if (local && /^@(?:-[\w]+-)?keyframes/.test(k)) params = params.replace(
      // generated by script/regexps.js
      /:?global\(\s*([-\w]+)\s*\)|()([-\w]+)/,
      state.l
    )

    buf.a(k, ' ', params, ' {\n')
    if (/@(?:-[\w]+-)?page/.test(k)) {
      declarations(v, buf, '', local, state)
    } else {
      sheet(v, buf, prefix, 1, local, state)
    }
    buf.c('}\n')

  } else {
    buf.a('@-error-unsupported-at-rule', ' ', JSON.stringify(k), ';\n')
  }
}
