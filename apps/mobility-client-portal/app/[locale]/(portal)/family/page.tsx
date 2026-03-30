/**
 * Client Portal — Family Members
 *
 * View and manage family members included in immigration applications.
 */
export const dynamic = 'force-dynamic'

export default async function FamilyPage() {
  // TODO: Replace with real client-scoped query
  const familyMembers = [
    { id: 'fm-001', name: 'Marie Mokolo', relation: 'spouse', dateOfBirth: '1985-06-12', passportExpiry: '2029-03-15', included: true },
    { id: 'fm-002', name: 'Pierre Mokolo Jr.', relation: 'child', dateOfBirth: '2012-09-22', passportExpiry: '2030-01-10', included: true },
    { id: 'fm-003', name: 'Céleste Mokolo', relation: 'child', dateOfBirth: '2016-04-08', passportExpiry: '2030-01-10', included: true },
  ]

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Family Members</h1>
          <p className="text-gray-500 mt-1">Dependents included in your applications</p>
        </div>
        <button className="px-4 py-2 text-sm font-medium text-white bg-[var(--primary)] rounded-lg hover:opacity-90 transition">
          Add Member
        </button>
      </div>

      <div className="space-y-4">
        {familyMembers.map((member) => (
          <div key={member.id} className="bg-white border border-[var(--border)] rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">{member.name}</h3>
                <p className="text-sm text-gray-500 capitalize">{member.relation}</p>
              </div>
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${member.included ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                {member.included ? 'Included' : 'Not included'}
              </span>
            </div>
            <div className="mt-3 flex gap-6 text-sm text-gray-500">
              <span>DOB: {member.dateOfBirth}</span>
              <span>Passport expires: {member.passportExpiry}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
