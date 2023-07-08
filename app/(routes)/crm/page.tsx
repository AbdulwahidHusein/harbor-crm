import Heading from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";
import React from "react";
import Container from "../components/ui/Container";

type Props = {};

const CrmPage = (props: Props) => {
  return (
    <Container
      title="CRM"
      description={"Everything you need to know about sales"}
    >
      <div>Module content here</div>
    </Container>
  );
};

export default CrmPage;
