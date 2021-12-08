export const mtoon_frag = `
#include<__decl__mtoonFragment>

#if defined(BUMP) || !defined(NORMAL) || (defined(ALPHATEST) && ALPHATEST)
#extension GL_OES_standard_derivatives : enable
#endif

#define CUSTOM_FRAGMENT_BEGIN
#ifdef LOGARITHMICDEPTH
#extension GL_EXT_frag_depth : enable
#endif

// Constants
#define RECIPROCAL_PI2 0.15915494
#define PI_2 6.28318530718
#define EPS_COL 0.00001
#define MAX_NUM_LIGHTS 16

//uniform vec3 vEyePosition;
//uniform vec3 vAmbientColor;
//#ifdef ALPHATEST
//uniform float alphaCutOff;
//#endif
uniform vec3 vEyeUp;
uniform float aspect;
uniform float isOutline;
uniform vec4 time;

// Input
varying vec3 vPositionW;

#ifdef NORMAL
    varying vec3 vNormalW;
#endif
#ifdef VERTEXCOLOR
    varying vec4 vColor;
#endif
#include<mainUVVaryingDeclaration>[1..7]

// Helper functions
#include<helperFunctions>

// Lights
#include<__decl__lightFragment>[0..maxSimultaneousLights]

#include<lightsFragmentFunctions>
#include<shadowsFragmentFunctions>

// Samplers
#include<samplerFragmentDeclaration>(_DEFINENAME_,DIFFUSE,_VARYINGNAME_,Diffuse,_SAMPLERNAME_,diffuse)
#include<samplerFragmentDeclaration>(_DEFINENAME_,AMBIENT,_VARYINGNAME_,Ambient,_SAMPLERNAME_,ambient)
#include<samplerFragmentDeclaration>(_DEFINENAME_,EMISSIVE,_VARYINGNAME_,Emissive,_SAMPLERNAME_,emissive)
#if defined(SPECULARTERM)
#include<samplerFragmentDeclaration>(_DEFINENAME_,SPECULAR,_VARYINGNAME_,Specular,_SAMPLERNAME_,specular)
#endif
#include<samplerFragmentDeclaration>(_DEFINENAME_,SHADE,_VARYINGNAME_,Shade,_SAMPLERNAME_,shade)
#include<samplerFragmentDeclaration>(_DEFINENAME_,RECEIVE_SHADOW,_VARYINGNAME_,ReceiveShadow,_SAMPLERNAME_,receiveShadow)
#include<samplerFragmentDeclaration>(_DEFINENAME_,SHADING_GRADE,_VARYINGNAME_,ShadingGrade,_SAMPLERNAME_,shadingGrade)
#include<samplerFragmentDeclaration>(_DEFINENAME_,RIM,_VARYINGNAME_,Rim,_SAMPLERNAME_,rim)
#include<samplerFragmentDeclaration>(_DEFINENAME_,MATCAP,_VARYINGNAME_,MatCap,_SAMPLERNAME_,matCap)
#include<samplerFragmentDeclaration>(_DEFINENAME_,OUTLINE_WIDTH,_VARYINGNAME_,OutlineWidth,_SAMPLERNAME_,outlineWidth)
#include<samplerFragmentDeclaration>(_DEFINENAME_,UV_ANIMATION_MASK,_VARYINGNAME_,UvAnimationMask,_SAMPLERNAME_,uvAnimationMask)

/**
* DirectionalLight, PointLight の角度を計算
*/
vec3 computeLightDirection(vec4 lightData) {
      return normalize(mix(lightData.xyz - vPositionW, -lightData.xyz, lightData.w));
}

/**
* SpotLight の角度を計算
*/
vec3 computeSpotLightDirection(vec4 lightData) {
     return normalize(lightData.xyz - vPositionW);
}

/**
* HemisphericLight の角度を計算
*/
vec3 computeHemisphericLightDirection(vec4 lightData, vec3 vNormal) {
     return normalize(lightData.xyz);
}

/**
* MToon シェーダーの陰実装
*/
//#define MTOON_FORWARD_ADD
/**
* Calculate light seoarately
*/
int realNumLights = 0;
vec3 totalDirectLighting = vec3(0.);
vec3 directLightingArr[MAX_NUM_LIGHTS] = vec3[MAX_NUM_LIGHTS](
    vec3(0.), vec3(0.), vec3(0.), vec3(0.),
    vec3(0.), vec3(0.), vec3(0.), vec3(0.),
    vec3(0.), vec3(0.), vec3(0.), vec3(0.),
    vec3(0.), vec3(0.), vec3(0.), vec3(0.)
);
void computeDirectLight(vec3 worldNormal, vec3 lightDirection, vec4 lightDiffuse, float shadowAttenuation) {
    realNumLights += 1;
    float _dotNL = dot(lightDirection, worldNormal);
    vec3 _lightColor = lightDiffuse.rgb * step(0.5, length(lightDirection)); // length(lightDir) is zero if directional light is disabled.
    // Direct Light
    vec3 _lighting = _lightColor;
    _lighting = mix(_lighting, vec3(max(EPS_COL, max(_lighting.x, max(_lighting.y, _lighting.z)))), lightColorAttenuation); // color atten
    #ifdef MTOON_FORWARD_ADD
    _lighting *= 0.5; // darken if additional light
    _lighting *= min(0., _dotNL) + 1.0; // darken dotNL < 0 area by using half lambert
    _lighting *= shadowAttenuation; // darken if receiving shadow
    #else
    // base light does not darken.
    // Make material receive shadow.
    _lighting *= shadowAttenuation;
    #endif

    // Compress total light
    directLightingArr[realNumLights] = _lighting;
    totalDirectLighting += _lighting;
}

vec4 computeMToonDiffuseLighting(vec3 worldView, vec3 worldNormal, vec2 mainUv, vec3 lightDirection, vec4 lightDiffuse, float shadowAttenuation) {
    realNumLights += 1;
    float _receiveShadow = receiveShadowRate;
#ifdef RECEIVE_SHADOW
    _receiveShadow = _receiveShadow * texture2D(receiveShadowSampler, mainUv).r * vReceiveShadowInfos.y;
#endif

    float _shadingGrade = 0.0;
#ifdef SHADING_GRADE
    _shadingGrade = 1.0 - texture2D(shadingGradeSampler, mainUv).r * vShadingGradeInfos.y;
#endif
    _shadingGrade = 1.0 - shadingGradeRate * _shadingGrade;

    // Lighting
    float _dotNL = dot(lightDirection, worldNormal);
    vec3 _lightColor = lightDiffuse.rgb * step(0.5, length(lightDirection)); // length(lightDir) is zero if directional light is disabled.
#ifdef MTOON_FORWARD_ADD
    float _lightAttenuation = 1.0;
#else
    float _lightAttenuation = shadowAttenuation * mix(1.0, shadowAttenuation, _receiveShadow);
#endif

    // lighting intensity
    float _lightIntensity = _dotNL;
    _lightIntensity = _lightIntensity * 0.5 + 0.5; // from [-1, +1] to [0, 1]
    _lightIntensity = _lightIntensity * _lightAttenuation; // receive shadow
    _lightIntensity = _lightIntensity * _shadingGrade; // darker
    _lightIntensity = _lightIntensity * 2.0 - 1.0; // from [0, 1] to [-1, +1]
    // tooned. mapping from [minIntensityThreshold, maxIntensityThreshold] to [0, 1]
    float _maxIntensityThreshold = mix(1.0, shadeShift, shadeToony);
    float _minIntensityThreshold = shadeShift;
    _lightIntensity = clamp((_lightIntensity - _minIntensityThreshold) / max(EPS_COL, (_maxIntensityThreshold - _minIntensityThreshold)), 0.0, 1.0);

    // Albedo color
    vec3 _shade = vShadeColor;
#ifdef SHADE
    _shade = _shade * texture2D(shadeSampler, mainUv).rgb * vShadeInfos.y;
#endif

    vec4 _lit = vDiffuseColor;
#ifdef DIFFUSE
    _lit = _lit * texture2D(diffuseSampler, mainUv) * vDiffuseInfos.y;
#endif
    vec3 _col = mix(_shade.rgb, _lit.rgb, _lightIntensity);

    // Direct Light
    vec3 _lightingGain = totalDirectLighting/float(realNumLights);
    _lightingGain = sinh(_lightingGain / 2.);
    vec3 _lighting = directLightingArr[realNumLights] * _lightingGain;
    _col *= _lighting;

    // Indirect Light
#ifdef MTOON_FORWARD_ADD
#else
    vec3 _toonedGI = vAmbientColor.rgb; // TODO: GI
    vec3 _indirectLighting = mix(_toonedGI, vAmbientColor.rgb, indirectLightIntensity);
    _indirectLighting = mix(_indirectLighting, vec3(max(EPS_COL, max(_indirectLighting.x, max(_indirectLighting.y, _indirectLighting.z)))), lightColorAttenuation); // color atten
    _col += _indirectLighting * _lit.rgb * _lightingGain;

    _col = min(_col.rgb, _lit.rgb); // comment out if you want to PBR absolutely.
#endif

    // parametric rim lighting
#ifdef MTOON_FORWARD_ADD
    vec3 _staticRimLighting = vec3(0.0);
    vec3 _mixedRimLighting = _lighting;
#else
    vec3 _staticRimLighting = vec3(1.0);
    vec3 _mixedRimLighting = _lighting + _indirectLighting;
#endif
    vec3 _rimLighting = mix(_staticRimLighting, _mixedRimLighting, rimLightingMix);
    vec3 _rimColor = vRimColor.rgb;
#ifdef RIM
    _rimColor = _rimColor * texture2D(rimSampler, vRimUV + mainUv).rgb * vRimInfos.y;
#endif
    vec3 _rim = pow(clamp(1.0 - dot(worldNormal, worldView) + rimLift, 0.0, 1.0), rimFresnelPower) * _rimColor.rgb;
    _col += mix(_rim * _rimLighting * _lightingGain, vec3(0.0), isOutline);

    // additive matcap
#ifdef MTOON_FORWARD_ADD
#else
#ifdef MATCAP
    vec3 _worldViewUp = normalize(vEyeUp - worldView * dot(worldView, vEyeUp));
    vec3 _worldViewRight = normalize(cross(worldView, _worldViewUp));
    vec2 _matCapUv = vec2(dot(_worldViewRight, worldNormal), dot(_worldViewUp, worldNormal)) * 0.5 + 0.5;
    // uv.y is reversed
    _matCapUv.y = (1.0 - _matCapUv.y);
    vec3 _matCapLighting = texture2D(matCapSampler, _matCapUv).rgb * vMatCapInfos.y;
    _col += mix(_matCapLighting * _lightingGain, vec3(0.0), isOutline);
#endif
#endif

    // Emission
#ifdef MTOON_FORWARD_ADD
#else
    vec3 _emission = vEmissiveColor.rgb;
#ifdef EMISSIVE
     _emission *= texture2D(emissiveSampler, mainUv).rgb * vEmissiveInfos.y;
#endif
     _col += mix(_emission * _lightingGain, vec3(0.0), isOutline);
#endif

    float _alpha = 1.0;

#if defined(ALPHABLEND) || defined(ALPHATEST)
    _alpha = mix(_lit.a, _lit.a * vOutlineColor.a, isOutline);
#endif

    // outline
#ifdef MTOON_OUTLINE_COLOR_FIXED
    _col = mix(_col, vOutlineColor.rgb, isOutline);
#elif defined(MTOON_OUTLINE_COLOR_MIXED)
    _col = mix(_col, vOutlineColor.rgb * mix(vec3(1.0), _col, outlineLightingMix), isOutline);
#else
#endif

// debug
//#define MTOON_DEBUG_LITSHADERATE
#ifdef MTOON_DEBUG_NORMAL
    #ifdef MTOON_FORWARD_ADD
        return vec4(0.0);
    #else
        return vec4(worldNormal * 0.5 + 0.5, _lit.a);
    #endif
#elif defined(MTOON_DEBUG_LITSHADERATE)
    #ifdef MTOON_FORWARD_ADD
        return vec4(0.0);
    #else
        return vec4(_lightIntensity, _lightIntensity, _lightIntensity, _lit.a);
    #endif
#endif

    return vec4(_col, _alpha);
}

#include<bumpFragmentMainFunctions>
#include<bumpFragmentFunctions>
#include<clipPlaneFragmentDeclaration>
#include<logDepthDeclaration>
#include<fogFragmentDeclaration>

#define CUSTOM_FRAGMENT_DEFINITIONS
void main(void) {
    #define CUSTOM_FRAGMENT_MAIN_BEGIN
    #ifdef MTOON_CLIP_IF_OUTLINE_IS_NONE
        #ifdef MTOON_OUTLINE_WIDTH_WORLD
        #elif defined(MTOON_OUTLINE_WIDTH_SCREEN)
        #else
            discard;
        #endif
    #endif

    #include<clipPlaneFragment>
    vec3 viewDirectionW=normalize(vEyePosition.xyz-vPositionW);

    // Base color
    // Strangely MToon decided to use base diffuse color as light color
    vec4 baseColor = vec4(1., 1., 1., 1.);
    vec3 diffuseColor = vec3(1., 1., 1.);
//    vec3 diffuseColor=vDiffuseColor.rgb;

    // Alpha
    float alpha = 1.0;
//    float alpha = vDiffuseColor.a;

// Bump
#ifdef NORMAL
     vec3 normalW = normalize(vNormalW);
#else
     vec3 normalW = normalize(-cross(dFdx(vPositionW), dFdy(vPositionW)));
#endif


// MToon UV
// 全てのテクスチャは diffuse(_MainTex) の UV 情報を利用する
vec2 mainUv = vec2(0.0);
#ifdef DIFFUSE
    mainUv += vDiffuseUV;
#elif defined(MAINUV1)
    mainUv += vMainUV1;
#elif defined(MAINUV2)
    mainUv += vMainUV2;
#elif defined(MAINUV3)
    mainUv += vMainUV3;
#elif defined(MAINUV4)
    mainUv += vMainUV4;
#elif defined(MAINUV5)
    mainUv += vMainUV5;
#elif defined(MAINUV6)
    mainUv += vMainUV6;
#endif

// UV animation
float uvAnim = time.y;
#ifdef UV_ANIMATION_MASK
uvAnim *= texture2D(uvAnimationMaskSampler, mainUv).r;
#endif
// Translate UV in bottom-left origin coordinates.
// UV is reversed
mainUv += vec2(-uvAnimationScrollX, -uvAnimationScrollY) * uvAnim;

// Rotate UV counter-clockwise around (0.5, 0.5) in bottom-left origin coordinates.
float rotateRad = uvAnimationRotation * PI_2 * uvAnim;
vec2 rotatePivot = vec2(0.5, 0.5);
mainUv = mat2(cos(rotateRad), -sin(rotateRad), sin(rotateRad), cos(rotateRad)) * (mainUv - rotatePivot) + rotatePivot;

#include<mtoonBumpFragment>
#ifdef TWOSIDEDLIGHTING
    normalW = gl_FrontFacing ? normalW : -normalW;
#endif

#ifdef DIFFUSE
//    baseColor=texture2D(diffuseSampler,vDiffuseUV+uvOffset);
    #if defined(ALPHATEST) && !defined(ALPHATEST_AFTERALLALPHACOMPUTATIONS)
        if (baseColor.a<alphaCutOff)
            discard;
    #endif
    #ifdef ALPHAFROMDIFFUSE
        alpha*=baseColor.a;
    #endif
    #define CUSTOM_FRAGMENT_UPDATE_ALPHA
    baseColor.rgb*=vDiffuseInfos.y;
#endif

#include<depthPrePass>
#define CUSTOM_FRAGMENT_UPDATE_DIFFUSE

// Ambient color
vec3 baseAmbientColor = vec3(1., 1., 1.);
#ifdef AMBIENT
    baseAmbientColor=texture2D(ambientSampler,vAmbientUV+uvOffset).rgb*vAmbientInfos.y;
#endif

#define CUSTOM_FRAGMENT_BEFORE_LIGHTS
#ifdef SPECULARTERM
    float glossiness=vSpecularColor.a;
    vec3 specularColor=vSpecularColor.rgb;
    #ifdef SPECULAR
        vec4 specularMapColor=texture2D(specularSampler,vSpecularUV+uvOffset);
        specularColor=specularMapColor.rgb;
        #ifdef GLOSSINESS
            glossiness=glossiness*specularMapColor.a;
        #endif
    #endif
#else
    float glossiness=0.;
#endif

// Lighting
vec3 diffuseBase = vec3(0., 0., 0.);
lightingInfo info;
#ifdef SPECULARTERM
    vec3 specularBase=vec3(0.,0.,0.);
#endif
float shadow = 1.;
vec3 lightDirection = vec3(0.0, 1.0, 0.0);

vec4 mtoonDiffuse = vec4(0.0, 0.0, 0.0, 1.0);

// 通常の lightFragment ではなく、自前実装の mtoonLightFragment を読み込む
#include<mtoonLightPreFragment>[0..maxSimultaneousLights]
realNumLights = 0;    // reset light count
#include<mtoonLightFragment>[0..maxSimultaneousLights]

#ifdef VERTEXALPHA
    alpha*=vColor.a;
#endif

#ifdef ALPHATEST
    #ifdef ALPHATEST_AFTERALLALPHACOMPUTATIONS
        if (alpha<alphaCutOff)
            discard;
    #endif
    #ifndef ALPHABLEND
        alpha=1.0;
    #endif
#endif

vec3 emissiveColor=vEmissiveColor.rgb;
// MToon use emissive texture in a non-standard way
//#ifdef EMISSIVE
//    emissiveColor+=texture2D(emissiveSampler,vEmissiveUV+uvOffset).rgb*vEmissiveInfos.y;
//#endif

#ifdef EMISSIVEASILLUMINATION
    vec3 finalDiffuse=clamp(diffuseBase*diffuseColor+vAmbientColor,0.0,1.0)*baseColor.rgb;
#else
    #ifdef LINKEMISSIVEWITHDIFFUSE
        vec3 finalDiffuse=clamp((diffuseBase)*diffuseColor+vAmbientColor,0.0,1.0)*baseColor.rgb;
    #else
        vec3 finalDiffuse=clamp(diffuseBase*diffuseColor+vAmbientColor,0.0,1.0)*baseColor.rgb;
    #endif
#endif
#ifdef SPECULARTERM
    vec3 finalSpecular=specularBase*specularColor;
    #ifdef SPECULAROVERALPHA
        alpha=clamp(alpha+dot(finalSpecular,vec3(0.3,0.59,0.11)),0.,1.);
    #endif
#else
    vec3 finalSpecular=vec3(0.0);
#endif

#ifdef EMISSIVEASILLUMINATION
    vec4 color=vec4(clamp(finalDiffuse*baseAmbientColor+finalSpecular,0.0,1.0),alpha);
#else
    vec4 color=vec4(finalDiffuse*baseAmbientColor+finalSpecular,alpha);
#endif

#define CUSTOM_FRAGMENT_BEFORE_FOG
color.rgb = max(color.rgb, 0.);
#include<logDepthFragment>
#include<fogFragment>

#ifdef PREMULTIPLYALPHA
    // Convert to associative (premultiplied) format if needed.
    color.rgb *= color.a;
#endif

#if !defined(PREPASS) || defined(WEBGL2)
    gl_FragColor=color;
#endif
}
`;
