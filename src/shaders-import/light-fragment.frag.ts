export const light_fragment_frag = `
#ifdef LIGHT{X}
    mtoonDiffuse = computeMToonDiffuseLighting(viewDirectionW.xyz, normalW.xyz, mainUv, lightDirection, light{X}.vLightDiffuse.rgba, shadow);
    diffuseBase += mtoonDiffuse.rgb;
    alpha = min(alpha, mtoonDiffuse.a);
    #if defined(ALPHATEST) && ALPHATEST
        alpha = (alpha - alphaCutOff) / max(fwidth(alpha), EPS_COL) + 0.5; // Alpha to Coverage
        if (alpha < alphaCutOff) {
            discard;
        }
        alpha = 1.0; // Discarded, otherwise it should be assumed to have full opacity
    #else
        if (alpha - 0.0001 < 0.000) { // Slightly improves rendering with layered transparency
            discard;
        }
    #endif
#endif
`;
