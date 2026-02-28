import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'New Listing',
}

/**
 * Create listing page — uses the core listing form.
 * If listing type is "vehicle", renders VehicleListingForm from @nzila/trade-cars.
 */
export default function NewListingPage() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-bold mb-6">Create Listing</h1>

      {/* Placeholder form — will be connected to server actions */}
      <form className="space-y-6">
        <div>
          <label htmlFor="title" className="block text-sm font-medium">
            Title
          </label>
          <input
            id="title"
            type="text"
            className="mt-1 block w-full rounded-md border p-2"
            placeholder="e.g. 2022 Toyota Land Cruiser 300"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="listingType" className="block text-sm font-medium">
              Listing Type
            </label>
            <select
              id="listingType"
              className="mt-1 block w-full rounded-md border p-2"
            >
              <option value="generic">Generic</option>
              <option value="vehicle">Vehicle</option>
            </select>
          </div>
          <div>
            <label htmlFor="currency" className="block text-sm font-medium">
              Currency
            </label>
            <input
              id="currency"
              type="text"
              maxLength={3}
              className="mt-1 block w-full rounded-md border p-2"
              placeholder="USD"
            />
          </div>
        </div>

        <div>
          <label htmlFor="askingPrice" className="block text-sm font-medium">
            Asking Price
          </label>
          <input
            id="askingPrice"
            type="text"
            className="mt-1 block w-full rounded-md border p-2"
            placeholder="25000.00"
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium">
            Description
          </label>
          <textarea
            id="description"
            rows={4}
            className="mt-1 block w-full rounded-md border p-2"
            placeholder="Describe the item..."
          />
        </div>

        {/* Vehicle-specific fields render conditionally via trade-cars */}
        {/* <VehicleListingForm value={vehicleData} onChange={setVehicleData} /> */}

        <button
          type="submit"
          className="rounded-md bg-blue-600 px-6 py-2 text-white hover:bg-blue-700"
        >
          Create Listing
        </button>
      </form>
    </main>
  )
}
