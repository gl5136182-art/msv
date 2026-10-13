declare module "*.svg?svgr" {
  import type { FC, SVGProps } from "react";

  const Componente: FC<SVGProps<SVGSVGElement>>;
  export default Componente;
}
