import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Artifact = {
  id: string;
  artifactType: string;
  artifactName: string;
  artifactHash: string;
  storageRef: string;
};

export function RemittanceArtifactCard({ artifact }: { artifact: Artifact }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{artifact.artifactName}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-sm text-muted-foreground">
        <p>Type: {artifact.artifactType}</p>
        <p>Hash: {artifact.artifactHash}</p>
        <p>Storage: {artifact.storageRef}</p>
      </CardContent>
    </Card>
  );
}
