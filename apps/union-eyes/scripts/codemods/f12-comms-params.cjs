const fs = require('fs')
const edit = (f, pairs) => {
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(`${f}: missing ${a.slice(0, 70)}`)
    s = s.replace(a, b)
  }
  fs.writeFileSync(f, s)
}
edit('app/api/communications/surveys/[surveyId]/route.ts', [[
  "  itemRoute: true,\n", "  itemRoute: true,\n  // The path segment is [surveyId]: the factory read params.id, which this route never has, so no item could be found.\n  paramName: 'surveyId',\n",
]])
edit('app/api/communications/polls/[pollId]/route.ts', [
  ["CRUD item route for polls", "CRUD item route for polls (the path segment is [pollId]; this file used to mount the collection handlers, so no poll could be read, changed or removed by id)"],
  ["const { GET, POST } = crudRoutes({", "const { GET, PATCH, DELETE } = crudRoutes({"],
  ["  orgScoped: true,\n", "  orgScoped: true,\n  itemRoute: true,\n  paramName: 'pollId',\n"],
  ["export { GET, POST };", "export { GET, PATCH, DELETE };"],
])
console.log('ok')
