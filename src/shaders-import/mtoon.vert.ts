export const mtoon_vert = `
// この include は特別で、 UboDeclaration または VertexDeclaration のどちらかに置換される
// @see effect.ts
#include<__decl__mtoonVertex>

// 基本的に default.vertex.fx を踏襲している

// Attributes
#define CUSTOM_VERTEX_BEGIN
attribute vec3 position;
#ifdef NORMAL
attribute vec3 normal;
#endif
#ifdef TANGENT
attribute vec4 tangent;
#endif
#ifdef UV1
attribute vec2 uv;
#endif
#include<uvAttributeDeclaration>[2..7]
#ifdef VERTEXCOLOR
attribute vec4 color;
#endif

#include<helperFunctions>

#include<bonesDeclaration>

// Uniforms
#include<instancesDeclaration>
#include<prePassVertexDeclaration>
#include<mainUVVaryingDeclaration>[1..7]
#include<samplerVertexDeclaration>(_DEFINENAME_,DIFFUSE,_VARYINGNAME_,Diffuse)
#include<samplerVertexDeclaration>(_DEFINENAME_,AMBIENT,_VARYINGNAME_,Ambient)
#include<samplerVertexDeclaration>(_DEFINENAME_,EMISSIVE,_VARYINGNAME_,Emissive)
#if defined(SPECULARTERM)
#include<samplerVertexDeclaration>(_DEFINENAME_,SPECULAR,_VARYINGNAME_,Specular)
#endif
#include<samplerVertexDeclaration>(_DEFINENAME_,BUMP,_VARYINGNAME_,Bump)

// Additional Uniforms
#include<samplerVertexDeclaration>(_DEFINENAME_,SHADE,_VARYINGNAME_,Shade)
#include<samplerVertexDeclaration>(_DEFINENAME_,RECEIVE_SHADOW,_VARYINGNAME_,ReceiveShadow)
#include<samplerVertexDeclaration>(_DEFINENAME_,SHADING_GRADE,_VARYINGNAME_,ShadingGrade)
#include<samplerVertexDeclaration>(_DEFINENAME_,RIM,_VARYINGNAME_,Rim)
#include<samplerVertexDeclaration>(_DEFINENAME_,MATCAP,_VARYINGNAME_,MatCap)
#include<samplerVertexDeclaration>(_DEFINENAME_,OUTLINE_WIDTH,_VARYINGNAME_,OutlineWidth)
#ifdef OUTLINE_WIDTH
    uniform sampler2D outlineWidthSampler;
#endif
#include<samplerVertexDeclaration>(_DEFINENAME_,UV_ANIMATION_MASK,_VARYINGNAME_,UvAnimationMask)

uniform float aspect;
uniform float isOutline;

// Output
varying vec3 vPositionW;
#ifdef NORMAL
    varying vec3 vNormalW;
#endif
#ifdef VERTEXCOLOR
    varying vec4 vColor;
#endif
#include<bumpVertexDeclaration>

#include<clipPlaneVertexDeclaration>

#include<fogVertexDeclaration>
#include<__decl__lightVxFragment>[0..maxSimultaneousLights]
#include<morphTargetsVertexGlobalDeclaration>
#include<morphTargetsVertexDeclaration>[0..maxSimultaneousMorphTargets]
#include<logDepthDeclaration>
#define CUSTOM_VERTEX_DEFINITIONS

void main(void) {
#define CUSTOM_VERTEX_MAIN_BEGIN
    vec3 positionUpdated = position;
#ifdef NORMAL
    vec3 normalUpdated = normal;
#endif
#ifdef TANGENT
    vec4 tangentUpdated = tangent;
#endif
#ifdef UV1
    vec2 uvUpdated=uv;
#endif
#include<morphTargetsVertexGlobal>
#include<morphTargetsVertex>[0..maxSimultaneousMorphTargets]
#define CUSTOM_VERTEX_UPDATE_POSITION
#define CUSTOM_VERTEX_UPDATE_NORMAL
#include<instancesVertex>
#if defined(PREPASS) && defined(PREPASS_VELOCITY) && !defined(BONES_VELOCITY_ENABLED)

vCurrentPosition=viewProjection*finalWorld*vec4(positionUpdated,1.0);
vPreviousPosition=previousViewProjection*finalPreviousWorld*vec4(positionUpdated,1.0);
#endif
#include<bonesVertex>

// Texture coordinates
#ifndef UV1
    vec2 uvUpdated=vec2(0.,0.);
#endif
#ifdef MAINUV1
    vMainUV1=uvUpdated;
#endif
#include<uvVariableDeclaration>[2..7]
#include<samplerVertexImplementation>(_DEFINENAME_,DIFFUSE,_VARYINGNAME_,Diffuse,_MATRIXNAME_,diffuse,_INFONAME_,DiffuseInfos.x)
#include<samplerVertexImplementation>(_DEFINENAME_,AMBIENT,_VARYINGNAME_,Ambient,_MATRIXNAME_,ambient,_INFONAME_,AmbientInfos.x)
#include<samplerVertexImplementation>(_DEFINENAME_,EMISSIVE,_VARYINGNAME_,Emissive,_MATRIXNAME_,emissive,_INFONAME_,EmissiveInfos.x)
#if defined(SPECULARTERM)
#include<samplerVertexImplementation>(_DEFINENAME_,SPECULAR,_VARYINGNAME_,Specular,_MATRIXNAME_,specular,_INFONAME_,SpecularInfos.x)
#endif
#include<samplerVertexImplementation>(_DEFINENAME_,BUMP,_VARYINGNAME_,Bump,_MATRIXNAME_,bump,_INFONAME_,BumpInfos.x)

float outlineTex = 1.0;
if (isOutline == 1.0) {
#include<samplerVertexImplementation>(_DEFINENAME_,OUTLINE_WIDTH,_VARYINGNAME_,OutlineWidth,_MATRIXNAME_,outlineWidth,_INFONAME_,OutlineWidthInfos.x)
#ifdef OUTLINE_WIDTH
    #if defined(MAINUV1)
        vec2 vOutlineWidthUV = vMainUV1;
    #elif defined(MAINUV2)
        vec2 vOutlineWidthUV = vMainUV2;
    #elif defined(MAINUV3)
        vec2 vOutlineWidthUV = vMainUV3;
    #elif defined(MAINUV4)
        vec2 vOutlineWidthUV = vMainUV4;
    #elif defined(MAINUV5)
        vec2 vOutlineWidthUV = vMainUV5;
    #elif defined(MAINUV6)
        vec2 vOutlineWidthUV = vMainUV6;
    #else
        vec2 vOutlineWidthUV = vec2(0., 0.);
    #endif
    outlineTex = texture2D(outlineWidthSampler, vOutlineWidthUV).r * vOutlineWidthInfos.y;
#endif

#if defined(MTOON_OUTLINE_WIDTH_WORLD) && defined(NORMAL)
    // ワールド座標の normal 分だけ移動する
    vec3 outlineOffset = normalize(finalWorld * vec4(normalUpdated, 1.0)).xyz * 0.01 * outlineWidth * outlineTex;
    positionUpdated.xyz += outlineOffset;
#endif
} // End isOutline == 1.0

    vec4 worldPos = finalWorld * vec4(positionUpdated, 1.0);

#ifdef NORMAL
    mat3 normalWorld = mat3(finalWorld);
    #if defined(INSTANCES) && defined(THIN_INSTANCES)
        vNormalW=normalUpdated/vec3(dot(normalWorld[0],normalWorld[0]),dot(normalWorld[1],normalWorld[1]),dot(normalWorld[2],normalWorld[2]));
        vNormalW=normalize(normalWorld*vNormalW);
    #else
        #ifdef NONUNIFORMSCALING
            normalWorld = transposeMat3(inverseMat3(normalWorld));
        #endif
    vNormalW = normalize(normalWorld * normalUpdated);
    #endif
#endif

#define CUSTOM_VERTEX_UPDATE_WORLDPOS
#ifdef MULTIVIEW
    if (gl_ViewID_OVR == 0u) {
        gl_Position = viewProjection * worldPos;
    } else {
        gl_Position = viewProjectionR * worldPos;
    }
#else
    gl_Position = viewProjection * worldPos;
#endif

    vPositionW = vec3(worldPos);

#include<prePassVertex>
#if defined(MTOON_OUTLINE_WIDTH_SCREEN) && defined(NORMAL)
    if (isOutline == 1.0) {
        vec4 projectedNormal = normalize(viewProjection * finalWorld * vec4(normalUpdated, 1.0));
        projectedNormal *= min(vertex.w, outlineScaledMaxDistance);
        projectedNormal.x *= aspect;
        gl_Position.xy += 0.01 * outlineWidth * outlineTex * projectedNormal.xy * clamp(
            1.0 - abs(normalize(view * vec4(normalUpdated, 1.0)).z), 0.0, 1.0); // ignore offset when normal toward camera
    }
#endif

    if (isOutline == 1.0) {
        gl_Position.z += 1E-2 * gl_Position.w; // anti-artifact magic from three-vrm
    }

#include<samplerVertexImplementation>(_DEFINENAME_,SHADE,_VARYINGNAME_,Shade,_MATRIXNAME_,shade,_INFONAME_,ShadeInfos.x)
#include<samplerVertexImplementation>(_DEFINENAME_,RECEIVE_SHADOW,_VARYINGNAME_,ReceiveShadow,_MATRIXNAME_,receiveShadow,_INFONAME_,ReceiveShadowInfos.x)
#include<samplerVertexImplementation>(_DEFINENAME_,SHADING_GRADE,_VARYINGNAME_,ShadingGrade,_MATRIXNAME_,shadingGrade,_INFONAME_,ShadingGradeInfos.x)
#include<samplerVertexImplementation>(_DEFINENAME_,RIM,_VARYINGNAME_,Rim,_MATRIXNAME_,rim,_INFONAME_,RimInfos.x)
#include<samplerVertexImplementation>(_DEFINENAME_,MATCAP,_VARYINGNAME_,MatCap,_MATRIXNAME_,matCap,_INFONAME_,MatCapInfos.x)
#include<samplerVertexImplementation>(_DEFINENAME_,UV_ANIMATION_MASK,_VARYINGNAME_,UvAnimationMask,_MATRIXNAME_,uvAnimationMask,_INFONAME_,UvAnimationMaskInfos.x)

#include<bumpVertex>
#include<clipPlaneVertex>
#include<fogVertex>
#include<shadowsVertex>[0..maxSimultaneousLights]
#ifdef VERTEXCOLOR

vColor=color;
#endif
#include<pointCloudVertex>
#include<logDepthVertex>
#define CUSTOM_VERTEX_MAIN_END
}
`;
