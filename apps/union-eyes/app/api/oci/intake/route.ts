// An alias of the OCRA handler. The access decision is the handler's own (capability token or session); an earlier local always-true access check
// looked like a gate and decided nothing, so it is removed.
export { GET, POST } from '../../ocra/start/route';
