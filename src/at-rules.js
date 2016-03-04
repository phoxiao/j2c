import {flatIter} from './helpers'
import {sheet} from './sheet'
import {declarations} from './declarations'

/**
 * Hanldes at-rules
 *
 * @param {object} parser - holds the parser-related methods and state
 * @param {object} emit - the contextual emitters to the final buffer
 * @param {array} k - The parsed at-rule, including the parameters,
 *                    if takes both parameters and a block.
 * @param {string} prefix - the current selector or the selector prefix
 *                          in case of nested rules
 * @param {string|string[]|object|object[]} v - Either parameters for
 *                                              block-less rules or
 *                                              their block
 *                                              for the others.
 * @param {string} inAtRule - are we nested in an at-rule?
 * @param {boolean} local - are we in @local or in @global scope?
 */

export function atRules(parser, emit, k, v, prefix, local, inAtRule) {

  for (var i = 0; i < parser.$a.length; i++) {

    if (parser.$a[i](parser, emit, k, v, prefix, local, inAtRule)) return

  }

  if (!k[3] && /^global$/.test(k[2])) {

    sheet(parser, emit, prefix, v, 0, inAtRule)


  } else if (!k[3] && /^local$/.test(k[2])) {

    sheet(parser, emit, prefix, v, 1, inAtRule)

  } else if (!k[3] && /^(?:namespace|import|charset)$/.test(k[2])) {
    flatIter(function(v) {

      emit.a(k[0], v)

    })(v)


  } else if (!k[3] && /^(?:font-face|viewport)$/.test(k[2])) {
    flatIter(function(v) {

      emit.a(k[1], '', 1)

      declarations(parser, emit, '', v, local)

      emit.A(k[1], '')

    })(v)

  } else if (k[3] && /^(?:media|supports|page|keyframes)$/.test(k[2])) {

    if (local && 'keyframes' == k[2]) {
      k[3] = k[3].replace(
        // generated by script/regexps.js
        /($^)|:?global\(\s*([_A-Za-z][-\w]*)\s*\)|()(-?[_A-Za-z][-\w]*)/,
        parser.L
      )
    }


    emit.a(k[1], k[3], 1)

    if ('page' == k[2]) {

      declarations(parser, emit, '', v, local)

    } else {

      sheet(
        parser, emit,
        'keyframes' == k[2] ? '' : prefix,
        v, local, 1
      )

    }

    emit.A(k[1], k[3])

  } else {

    emit.a('@-error-unsupported-at-rule', JSON.stringify(k[0]))

  }
}
