export default function Home() {
  // E5-C Probe B FAIL: intentional TypeScript compile break — DO NOT MERGE
  const broken: string = 12345
  return (
    <main>
      <h1>test-scaffold-gp</h1>
      <p>{broken}</p>
    </main>
  )
}
