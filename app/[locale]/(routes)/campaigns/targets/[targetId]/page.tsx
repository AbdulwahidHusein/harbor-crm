import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { BasicView } from "./components/BasicView";
import { getTarget } from "@/actions/crm/get-target";

const TargetViewPage = async (props: any) => {
  const params = await props.params;
  const { targetId } = params;
  const target: any = await getTarget(targetId);

  if (!target) return <div>Target not found</div>;

  return (
    <Container
      title={[target?.first_name, target?.last_name].filter(Boolean).join(" ") || "Target"}
      description="Campaign target"
    >
      <div className="space-y-5">
        <BasicView data={target} />
      </div>
    </Container>
  );
};

export default TargetViewPage;
