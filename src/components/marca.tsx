import type { SVGProps } from "react";
import LogoSvg from "../../public/brand/manserv-logo.svg?svgr";
import SimboloSvg from "../../public/brand/manserv-simbolo.svg?svgr";

// Os SVGs usam fill="currentColor": a cor vem do CSS (`text-white` sobre laranja ou grafite,
// `text-grafite` sobre branco ou cinza). Não recolorir com laranja nem distorcer (DESIGN §9).
type MarcaProps = Omit<SVGProps<SVGSVGElement>, "width" | "height"> & {
  /** Altura em px. A largura segue a proporção do arquivo. */
  altura?: number;
};

export function LogoManserv({ altura = 20, ...props }: MarcaProps) {
  return <LogoSvg height={altura} style={{ width: "auto" }} {...props} />;
}

export function SimboloManserv({ altura = 20, ...props }: MarcaProps) {
  return <SimboloSvg height={altura} style={{ width: "auto" }} {...props} />;
}
