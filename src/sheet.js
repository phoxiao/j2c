import {type, ARRAY, OBJECT, STRING, emptyArray, cartesian, concat} from './helpers'
import {declarations} from './declarations'

var findClass = /()(?::global\(\s*(\.[-\w]+)\s*\)|(\.)([-\w]+))/g
// Add rulesets and other CSS statements to the sheet.
export function sheet(statements, buf, prefix, rawPrefix, vendors, local, ns) {
  var k, kk, v, inDeclaration

  switch (type.call(statements)) {

  case ARRAY:
    for (k = 0; k < statements.length; k++)
      sheet(statements[k], buf, prefix, rawPrefix, vendors, local, ns)
    break

  case OBJECT:
    for (k in statements) {
      v = statements[k]
      if (prefix && /^[-\w$]+$/.test(k)) {
        if (!inDeclaration) {
          inDeclaration = 1
          buf.push(( prefix || '*' ) +' {')
        }
        declarations(v, buf, k, vendors, local, ns)
      } else if (/^@/.test(k)) {
        // Handle At-rules


        inDeclaration = (inDeclaration && buf.push('}') && 0)

        if (/^@(?:namespace|import|charset)$/.test(k)) {
          if(type.call(v) == ARRAY){
            for (kk = 0; kk < v.length; kk++) {
              buf.push(k + ' ' + v[kk] + ';')
            }
          } else {
            buf.push(k + ' ' + v + ';')
          }
        } else if (/^@keyframes /.test(k)) {
          k = local ? k.replace(
            // generated by script/regexps.js
            /( )(?::global\(\s*([-\w]+)\s*\)|()([-\w]+))/,
            ns.l
          ) : k
          // add a @-webkit-keyframes block too.

          buf.push('@-webkit-' + k.slice(1) + ' {')
          sheet(v, buf, '', '', ['webkit'])
          buf.push('}')

          buf.push(k + ' {')
          sheet(v, buf, '', '', vendors, local, ns)
          buf.push('}')

        } else if (/^@extends?$/.test(k)) {

          /*eslint-disable no-cond-assign*/
          // pick the last class to be extended
          while (kk = findClass.exec(rawPrefix)) k = kk[4]
          /*eslint-enable no-cond-assign*/
          if (k == null || !local) {
            // we're in a @global{} block
            buf.push('@-error-cannot-extend-in-global-context ' + JSON.stringify(rawPrefix) +';')
            continue
          } else if (/^@extends?$/.test(k)) {
            // no class in the selector
            buf.push('@-error-no-class-to-extend-in ' + JSON.stringify(rawPrefix) +';')
            continue
          }
          ns.e(
            type.call(v) == ARRAY ? v.map(function (parent) {
              return parent.replace(/()(?::global\(\s*(\.[-\w]+)\s*\)|()\.([-\w]+))/, ns.l)
            }).join(' ') : v.replace(/()(?::global\(\s*(\.[-\w]+)\s*\)|()\.([-\w]+))/, ns.l),
            k
          )

        } else if (/^@(?:font-face$|viewport$|page )/.test(k)) {
          sheet(v, buf, k, k, emptyArray, {L:0})

        } else if (/^@global$/.test(k)) {
          sheet(v, buf, prefix, rawPrefix, vendors, 0, ns)

        } else if (/^@local$/.test(k)) {
          sheet(v, buf, prefix, rawPrefix, vendors, 1, ns)

        } else if (/^@(?:media |supports |document )./.test(k)) {
          buf.push(k + ' {')
          sheet(statements[k], buf, prefix, rawPrefix, vendors, local, ns)
          buf.push('}')

        } else {
          buf.push('@-error-unsupported-at-rule ' + JSON.stringify(k) + ';')
        }
      } else {
        // selector or nested sub-selectors

        inDeclaration = (inDeclaration && buf.push('}') && 0)

        sheet(v, buf,
          (kk = /,/.test(prefix) || prefix && /,/.test(k)) ?
            cartesian(prefix.split(','), ( local ?
          k.replace(
            /()(?::global\(\s*(\.[-\w]+)\s*\)|(\.)([-\w]+))/g, ns.l
          ) : k
        ).split(','), prefix).join(',') :
            concat(prefix, ( local ?
          k.replace(
            /()(?::global\(\s*(\.[-\w]+)\s*\)|(\.)([-\w]+))/g, ns.l
          ) : k
        ), prefix),
          kk ?
            cartesian(rawPrefix.split(','), k.split(','), rawPrefix).join(',') :
            concat(rawPrefix, k, rawPrefix),
          vendors,
          local, ns
        )
      }
    }
    if (inDeclaration) buf.push('}')
    break
  case STRING:
    buf.push(
        ( prefix || ':-error-no-selector' ) + ' {'
      )
    declarations(statements, buf, '', vendors, local, ns)
    buf.push('}')
  }
}
