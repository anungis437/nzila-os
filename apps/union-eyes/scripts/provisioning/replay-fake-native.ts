export const fakeNativeTypeIo = Object.freeze({
  text: Object.freeze({
    oid: '25',
    input: 'textin',
    output: 'textout',
    inputOid: '46',
    outputOid: '47',
  }),
  varchar: Object.freeze({
    oid: '1043',
    input: 'varcharin',
    output: 'varcharout',
    inputOid: '1046',
    outputOid: '1047',
  }),
  uuid: Object.freeze({
    oid: '2950',
    input: 'uuid_in',
    output: 'uuid_out',
    inputOid: '2952',
    outputOid: '2953',
  }),
  int4: Object.freeze({
    oid: '23',
    input: 'int4in',
    output: 'int4out',
    inputOid: '42',
    outputOid: '43',
  }),
  int8: Object.freeze({
    oid: '20',
    input: 'int8in',
    output: 'int8out',
    inputOid: '460',
    outputOid: '461',
  }),
  _uuid: Object.freeze({
    oid: '2951',
    input: 'array_in',
    output: 'array_out',
    inputOid: '750',
    outputOid: '751',
  }),
})
interface Builtin {
  oid: string
  name: string
  arguments: string
  variadic: string
  result: string
  body: string
}
const builtins: Record<string, Builtin> = {
  'current_setting(text,boolean)': {
    oid: '3294',
    name: 'current_setting',
    arguments: '25 16',
    variadic: '0',
    result: 'text',
    body: 'show_config_by_name_missing_ok',
  },
  'format(text,"any")': {
    oid: '3540',
    name: 'format',
    arguments: '25 2276',
    variadic: '2276',
    result: 'text',
    body: 'text_format',
  },
  'to_regclass(text)': {
    oid: '3479',
    name: 'to_regclass',
    arguments: '25',
    variadic: '0',
    result: 'regclass',
    body: 'to_regclass',
  },
}
const argumentNames: Record<string, string> = {
  text: 'text',
  varchar: 'varchar',
  uuid: 'uuid',
  int4: 'int4',
  int8: 'int8',
  _uuid: 'anyarray',
}
const displayNames: Record<string, string> = {
  varchar: 'character varying',
  int4: 'integer',
  int8: 'bigint',
  _uuid: 'anyarray',
}
for (const [name, type] of Object.entries(fakeNativeTypeIo)) {
  const extended = name === 'varchar' || name === '_uuid'
  builtins[`${type.input}(cstring${extended ? ',oid,integer' : ''})`] = {
    oid: type.inputOid,
    name: type.input,
    arguments: extended ? '2275 26 23' : '2275',
    variadic: '0',
    result: displayNames[name] ?? name,
    body: type.input,
  }
  builtins[`${type.output}(${argumentNames[name]})`] = {
    oid: type.outputOid,
    name: type.output,
    arguments: name === '_uuid' ? '2277' : type.oid,
    variadic: '0',
    result: 'cstring',
    body: type.output,
  }
}
export function fakeNativeBuiltin(signature: string, visible: boolean) {
  const builtin = builtins[signature]
  return builtin
    ? {
        oid: builtin.oid,
        schema: 'pg_catalog',
        name: builtin.name,
        body: builtin.body,
        language: 'internal',
        kind: 'f',
        definer: false,
        config: null,
        argument_oids: builtin.arguments,
        variadic: builtin.variadic,
        result: builtin.result,
        visible,
      }
    : null
}
export function fakeNativeOverloads(name: string) {
  return Object.values(builtins)
    .filter((row) => row.name === name)
    .map((row) => ({
      oid: row.oid,
      schema: 'pg_catalog',
      name: row.name,
      argument_oids: row.arguments,
      variadic: row.variadic,
    }))
}
export function fakeNativeEquality(oid: string, visible: boolean) {
  const native: Record<string, { oid: string; functionOid: string; body: string }> = {
    '25': { oid: '98', functionOid: '67', body: 'texteq' },
    '2950': { oid: '2972', functionOid: '2956', body: 'uuid_eq' },
    '23': { oid: '96', functionOid: '65', body: 'int4eq' },
    '20': { oid: '410', functionOid: '467', body: 'int8eq' },
  }
  const operator = native[oid]
  return operator
    ? {
        oid: operator.oid,
        schema: 'pg_catalog',
        name: '=',
        left_type: oid,
        right_type: oid,
        result: '16',
        body: operator.body,
        language: 'internal',
        visible,
        function_oid: operator.functionOid,
        function_schema: 'pg_catalog',
        argument_oids: `${oid} ${oid}`,
        function_result: '16',
        function_kind: 'f',
        definer: false,
        config: null,
      }
    : null
}
