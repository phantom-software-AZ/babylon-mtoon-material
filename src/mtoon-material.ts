import { serialize, SerializationHelper, serializeAsColor3, expandToProperty, serializeAsTexture } from "@babylonjs/core/Misc/decorators";
import { IAnimatable } from "@babylonjs/core/Animations/animatable.interface";

import { Nullable } from "@babylonjs/core/types";
import { Scene } from "@babylonjs/core/scene";
import { Matrix, Color3, Vector4 } from "@babylonjs/core/Maths/math";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { SubMesh } from "@babylonjs/core/Meshes/subMesh";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { PrePassConfiguration } from "@babylonjs/core/Materials/prePassConfiguration";

import { Material, ICustomShaderNameResolveOptions } from "@babylonjs/core/Materials/material";
import { PushMaterial } from "@babylonjs/core/Materials/pushMaterial";
import { MaterialHelper } from "@babylonjs/core/Materials/materialHelper";

import { BaseTexture } from "@babylonjs/core/Materials/Textures/baseTexture";

import { Constants } from "@babylonjs/core/Engines/constants";
import { EffectFallbacks } from "@babylonjs/core/Materials/effectFallbacks";
import { Effect, IEffectCreationOptions } from "@babylonjs/core/Materials/effect";
import { DetailMapConfiguration } from "@babylonjs/core/Materials/material.detailMapConfiguration";

import { getInspectableCustomProperties } from "./inspectable-custom-properties";
import { MToonMaterialDefines } from "./mtoon-material-defines";
import { MToonOutlineRenderer } from "./mtoon-outline-renderer";
import {MaterialFlags, _TypeStore} from "@babylonjs/core";

// シェーダ文字列を取得
const UboDeclaration = require("./shaders/ubo-declaration.vert");
const VertexDeclaration = require("./shaders/vertex-declaration.vert");
const FragmentDeclaration = require("./shaders/fragment-declaration.frag");
const BumpFragment = require("./shaders/bump-fragment.frag");
const LightFragment = require("./shaders/light-fragment.frag");
const VertexShader = require("./shaders/mtoon.vert");
const FragmentShader = require("./shaders/mtoon.frag");

/**
 * デバッグモード
 */
export enum DebugMode {
    None = 0,
    Normal,
    LitShadeRate,
}
/**
 * アウトラインカラーモード
 */
export enum OutlineColorMode {
    FixedColor = 0,
    MixedLighting,
}
/**
 * アウトライン幅モード
 */
export enum OutlineWidthMode {
    None = 0,
    WorldCorrdinates,
    ScreenCoordinates,
}
/**
 * Cull モード
 */
export enum CullMode {
    Off = 0,
    Front,
    Back,
}

const onCreatedEffectParameters = { effect: null as unknown as Effect, subMesh: null as unknown as Nullable<SubMesh> };

/**
 * MToonMaterial
 *
 * MToon は日本のアニメ的表現をすることを目標としています。
 * 主色 (Lit Color) と陰色 (Shade Color) の 2 色を、Lighting パラメータや光源環境に応じて混合することでそれを実現します。
 * VRM での出力パラメータとプロパティのマッピングは下記となります。
 *
 * @link https://github.com/Santarh/MToon/
 * @link https://vrm.dev/univrm/shaders/mtoon/
 */
export class MToonMaterial extends PushMaterial {
//#region Properties
//#region Textures
    @serializeAsTexture("diffuseTexture")
    private _diffuseTexture: Nullable<BaseTexture> = null;
    /**
     * The basic texture of the material as viewed under a light.
     */
    @expandToProperty("_markAllSubMeshesAsTexturesAndMiscDirty")
    public diffuseTexture!: Nullable<BaseTexture>;

    @serializeAsTexture("ambientTexture")
    private _ambientTexture: Nullable<BaseTexture> = null;
    /**
     * AKA Occlusion Texture in other nomenclature, it helps adding baked shadows into your material.
     */
    @expandToProperty("_markAllSubMeshesAsTexturesDirty")
    public ambientTexture!: Nullable<BaseTexture>;

    @serializeAsTexture("emissiveTexture")
    private _emissiveTexture: Nullable<BaseTexture> = null;
    /**
     * Define texture of the material as if self lit.
     * This will be mixed in the final result even in the absence of light.
     */
    @expandToProperty("_markAllSubMeshesAsTexturesDirty")
    public emissiveTexture!: Nullable<BaseTexture>;

    @serializeAsTexture("specularTexture")
    private _specularTexture: Nullable<BaseTexture> = null;
    /**
     * Define how the color and intensity of the highlight given by the light in the material.
     */
    @expandToProperty("_markAllSubMeshesAsTexturesDirty")
    public specularTexture!: Nullable<BaseTexture>;

    @serializeAsTexture("bumpTexture")
    private _bumpTexture: Nullable<BaseTexture> = null;
    /**
     * Bump mapping is a technique to simulate bump and dents on a rendered surface.
     * These are made by creating a normal map from an image. The means to do this can be found on the web, a search for 'normal map generator' will bring up free and paid for methods of doing this.
     * @see https://doc.babylonjs.com/how_to/more_materials#bump-map
     */
    @expandToProperty("_markAllSubMeshesAsTexturesDirty")
    public bumpTexture!: Nullable<BaseTexture>;

    @serializeAsTexture("shadeTexture")
    private _shadeTexture: Nullable<BaseTexture> = null;
    /**
     * 陰になる部分の色テクスチャ
     */
    @expandToProperty("_markAllSubMeshesAsTexturesDirty")
    public shadeTexture!: Nullable<BaseTexture>;

    @serializeAsTexture("receiveShadowTexture")
    private _receiveShadowTexture: Nullable<BaseTexture> = null;
    /**
     * どれだけ影を受け付けるかのテクスチャ
     * receiveShadowRate * texture.a
     */
    @expandToProperty("_markAllSubMeshesAsTexturesDirty")
    public receiveShadowTexture!: Nullable<BaseTexture>;

    @serializeAsTexture("shadingGradeTexture")
    private _shadingGradeTexture: Nullable<BaseTexture> = null;
    /**
     * 陰部分の暗さテクスチャ
     * shadingGradeRate * (1.0 - texture.r))
     */
    @expandToProperty("_markAllSubMeshesAsTexturesDirty")
    public shadingGradeTexture!: Nullable<BaseTexture>;

    @serializeAsTexture("rimTexture")
    private _rimTexture: Nullable<BaseTexture> = null;
    /**
     * Parametric Rim Lighting テクスチャ
     */
    @expandToProperty("_markAllSubMeshesAsTexturesDirty")
    public rimTexture!: Nullable<BaseTexture>;

    @serializeAsTexture("matCapTexture")
    private _matCapTexture: Nullable<BaseTexture> = null;
    /**
     * MatCap ライティングテクスチャ
     */
    @expandToProperty("_markAllSubMeshesAsTexturesDirty")
    public matCapTexture!: Nullable<BaseTexture>;

    @serializeAsTexture("outlineWidthTexture")
    private _outlineWidthTexture: Nullable<BaseTexture> = null;
    /**
     * アウトラインの幅の調整テクスチャ
     */
    @expandToProperty("_markAllSubMeshesAsTexturesDirty")
    public outlineWidthTexture!: Nullable<BaseTexture>;

    @serializeAsTexture("uvAnimationMaskTexture")
    private _uvAnimationMaskTexture: Nullable<BaseTexture> = null;
    /**
     * UV アニメーションマスクテクスチャ
     */
    @expandToProperty("_markAllSubMeshesAsTexturesDirty")
    public uvAnimationMaskTexture!: Nullable<BaseTexture>;

    /**
     * アクティブなテクスチャ参照の一覧
     */
    private appendedActiveTextures(): BaseTexture[] {
        return [
            this._diffuseTexture,
            this._ambientTexture,
            this._emissiveTexture,
            this._specularTexture,
            this._bumpTexture,
            this._shadeTexture,
            this._receiveShadowTexture,
            this._shadingGradeTexture,
            this._rimTexture,
            this._matCapTexture,
            this._outlineWidthTexture,
            this._uvAnimationMaskTexture,
        ].filter((t) => t !== null) as BaseTexture[];
    }
//#endregion

//#region Colors
    /**
     * The color of the material lit by the environmental background lighting.
     * @see https://doc.babylonjs.com/babylon101/materials#ambient-color-example
     */
    @serializeAsColor3("ambient")
    public ambientColor = new Color3(0, 0, 0);

    /**
     * The basic color of the material as viewed under a light.
     */
    @serializeAsColor3("diffuse")
    public diffuseColor = new Color3(1, 1, 1);

    /**
     * Define how the color and intensity of the highlight given by the light in the material.
     */
    @serializeAsColor3("specular")
    public specularColor = new Color3(1, 1, 1);

    /**
     * Define the color of the material as if self lit.
     * This will be mixed in the final result even in the absence of light.
     */
    @serializeAsColor3("emissive")
    public emissiveColor = new Color3(0, 0, 0);

    /**
     * shadeTexture に乗算される色
     */
    @serializeAsColor3("shade")
    public shadeColor = new Color3(0.97, 0.81, 0.86);
    /**
     * Rim の色
     */
    @serializeAsColor3("rim")
    public rimColor = new Color3(0, 0, 0);
    /**
     * アウトラインの色
     */
    @serializeAsColor3("outline")
    public outlineColor = new Color3(0, 0, 0);
//#endregion

//#region babylon parameters
    /**
     * Defines how sharp are the highlights in the material.
     * The bigger the value the sharper giving a more glossy feeling to the result.
     * Reversely, the smaller the value the blurrier giving a more rough feeling to the result.
     */
    @serialize()
    public specularPower = 64;

    @serialize("useAlphaFromDiffuseTexture")
    private _useAlphaFromDiffuseTexture = true;
    /**
     * Does the transparency come from the diffuse texture alpha channel.
     */
    @expandToProperty("_markAllSubMeshesAsTexturesAndMiscDirty")
    public useAlphaFromDiffuseTexture!: boolean;

    @serialize("useEmissiveAsIllumination")
    private _useEmissiveAsIllumination = false;
    /**
     * If true, the emissive value is added into the end result, otherwise it is multiplied in.
     */
    @expandToProperty("_markAllSubMeshesAsTexturesDirty")
    public useEmissiveAsIllumination!: boolean;

    @serialize("linkEmissiveWithDiffuse")
    private _linkEmissiveWithDiffuse = false;
    /**
     * If true, some kind of energy conservation will prevent the end result to be more than 1 by reducing
     * the emissive level when the final color is close to one.
     */
    @expandToProperty("_markAllSubMeshesAsTexturesDirty")
    public linkEmissiveWithDiffuse!: boolean;

    @serialize("useSpecularOverAlpha")
    private _useSpecularOverAlpha = false;
    /**
     * Specifies that the material will keep the specular highlights over a transparent surface (only the most luminous ones).
     * A car glass is a good exemple of that. When sun reflects on it you can not see what is behind.
     */
    @expandToProperty("_markAllSubMeshesAsTexturesDirty")
    public useSpecularOverAlpha!: boolean;

    @serialize("disableLighting")
    private _disableLighting = false;
    /**
     * Does lights from the scene impacts this material.
     * It can be a nice trick for performance to disable lighting on a fully emissive material.
     */
    @expandToProperty("_markAllSubMeshesAsLightsDirty")
    public disableLighting!: boolean;

    @serialize("useObjectSpaceNormalMap")
    private _useObjectSpaceNormalMap = false;
    /**
     * Allows using an object space normal map (instead of tangent space).
     */
    @expandToProperty("_markAllSubMeshesAsTexturesDirty")
    public useObjectSpaceNormalMap!: boolean;

    @serialize("useParallax")
    private _useParallax = false;
    /**
     * Is parallax enabled or not.
     * @see https://doc.babylonjs.com/how_to/using_parallax_mapping
     */
    @expandToProperty("_markAllSubMeshesAsTexturesDirty")
    public useParallax!: boolean;

    @serialize("useParallaxOcclusion")
    private _useParallaxOcclusion = false;
    /**
     * Is parallax occlusion enabled or not.
     * If true, the outcome is way more realistic than traditional Parallax but you can expect a performance hit that worthes consideration.
     * @see https://doc.babylonjs.com/how_to/using_parallax_mapping
     */
    @expandToProperty("_markAllSubMeshesAsTexturesDirty")
    public useParallaxOcclusion!: boolean;

    /**
     * Defines the alpha limits in alpha test mode.
     */
    @serialize()
    public alphaCutOff = 0.4;

    @serialize("useGlossinessFromSpecularMapAlpha")
    private _useGlossinessFromSpecularMapAlpha = false;
    /**
     * Defines if the glossiness/roughness of the material should be read from the specular map alpha channel
     */
    @expandToProperty("_markAllSubMeshesAsTexturesDirty")
    public useGlossinessFromSpecularMapAlpha!: boolean;

    @serialize("maxSimultaneousLights")
    private _maxSimultaneousLights = 16;
    /**
     * Defines the maximum number of lights that can be used in the material
     */
    @expandToProperty("_markAllSubMeshesAsLightsDirty")
    public maxSimultaneousLights!: number;

    @serialize("twoSidedLighting")
    private _twoSidedLighting = false;
    /**
     * If sets to true and backfaceCulling is false, normals will be flipped on the backside.
     */
    @expandToProperty("_markAllSubMeshesAsTexturesDirty")
    public twoSidedLighting!: boolean;

    /**
     * 頂点カラー非対応
     */
    public readonly useVertexColor = false;
    /**
     * シェーダボーンは利用可能
     */
    public readonly useBones = true;
    /**
     * シェーダモーフターゲットは利用可能
     */
    public readonly useMorphTargets = true;
    /**
     * 頂点アルファは非対応
     */
    public readonly useVertexAlpha = false;
    /**
     * Defines additional PrePass parameters for the material.
     */
    public readonly prePassConfiguration: PrePassConfiguration;

    /**
     * Can this material render to prepass
     */
    public get isPrePassCapable(): boolean {
        return true;
    }

    public get canRenderToMRT() {
        return false;
    }

    /**
     * Defines the detail map parameters for the material.
     */
    public readonly detailMap = new DetailMapConfiguration(this._markAllSubMeshesAsTexturesDirty.bind(this));

    protected _worldViewProjectionMatrix = Matrix.Zero();
    protected _globalAmbientColor = new Color3(0, 0, 0);
    protected _useLogarithmicDepth!: boolean;
//#endregion

//#region MToon parameters
    @serialize("bumpScale")
    private _bumpScale = 0.1;
    @expandToProperty("_markAllSubMeshesAsTexturesAndMiscDirty")
    public bumpScale!: number;

    /**
     * Apply a scaling factor that determine which "depth" the height map should reprensent. A value between 0.05 and 0.1 is reasonnable in Parallax, you can reach 0.2 using Parallax Occlusion.
     */
    @serialize()
    public parallaxScaleBias = this._bumpScale;

    @serialize("receiveShadowRate")
    private _receiveShadowRate = 1;
    @expandToProperty("_markAllSubMeshesAsLightsDirty")
    public receiveShadowRate!: number;

    @serialize("shadingGradeRate")
    private _shadingGradeRate = 1;
    @expandToProperty("_markAllSubMeshesAsLightsDirty")
    public shadingGradeRate!: number;

    @serialize("shadeShift")
    private _shadeShift = 0;
    @expandToProperty("_markAllSubMeshesAsLightsDirty")
    public shadeShift!: number;

    @serialize("shadeToony")
    private _shadeToony = 0.9;
    @expandToProperty("_markAllSubMeshesAsLightsDirty")
    public shadeToony!: number;

    @serialize("lightColorAttenuation")
    private _lightColorAttenuation = 0;
    @expandToProperty("_markAllSubMeshesAsLightsDirty")
    public lightColorAttenuation!: number;

    @serialize("indirectLightIntensity")
    private _indirectLightIntensity = 0.1;
    @expandToProperty("_markAllSubMeshesAsLightsDirty")
    public indirectLightIntensity!: number;

    @serialize("rimLightingMix")
    private _rimLightingMix = 0;
    @expandToProperty("_markAllSubMeshesAsLightsDirty")
    public rimLightingMix!: number;

    @serialize("rimFresnelPower")
    private _rimFresnelPower = 1;
    @expandToProperty("_markAllSubMeshesAsLightsDirty")
    public rimFresnelPower!: number;

    @serialize("rimLift")
    private _rimLift = 0;
    @expandToProperty("_markAllSubMeshesAsLightsDirty")
    public rimLift!: number;

    @serialize("outlineWidth")
    private _outlineWidth = 0.5;
    @expandToProperty("_markAllSubMeshesAsAttributesDirty")
    public outlineWidth!: number;

    @serialize("outlineScaledMaxDistance")
    private _outlineScaledMaxDistance = 1;
    @expandToProperty("_markAllSubMeshesAsAttributesDirty")
    public outlineScaledMaxDistance!: number;

    @serialize("outlineLightingMix")
    private _outlineLightingMix = 1;
    @expandToProperty("_markAllSubMeshesAsAttributesDirty")
    public outlineLightingMix!: number;

    @serialize("uvAnimationScrollX")
    private _uvAnimationScrollX = 0;
    @expandToProperty("_markAllSubMeshesAsMiscDirty")
    public uvAnimationScrollX!: number;

    @serialize("uvAnimationScrollY")
    private _uvAnimationScrollY = 0;
    @expandToProperty("_markAllSubMeshesAsMiscDirty")
    public uvAnimationScrollY!: number;

    @serialize("uvAnimationRotation")
    private _uvAnimationRotation = 0;
    @expandToProperty("_markAllSubMeshesAsMiscDirty")
    public uvAnimationRotation!: number;

    @serialize("debugMode")
    private _debugMode = DebugMode.None;
    /** @hidden */
    @expandToProperty("_markAllSubMeshesAsMiscDirty")
    public debugMode: DebugMode = DebugMode.None;

    /**
     * MToon Outline Renderer
     * @private
     */
    private outlineRenderer = new MToonOutlineRenderer(this.getScene(), this);

    @serialize("outlineWidthMode")
    private _outlineWidthMode: OutlineWidthMode = OutlineWidthMode.None;
    @expandToProperty("_markAllSubMeshesAsMiscDirty")
    public outlineWidthMode: OutlineWidthMode = OutlineWidthMode.None;

    @serialize("outlineColorMode")
    private _outlineColorMode: OutlineColorMode = OutlineColorMode.MixedLighting;
    @expandToProperty("_markAllSubMeshesAsMiscDirty")
    public outlineColorMode: OutlineColorMode = OutlineColorMode.MixedLighting;

    @serialize("cullMode")
    private _cullMode: CullMode = CullMode.Back;
    public get cullMode() {
      return this._cullMode;
    }

    public set cullMode(value: CullMode) {
        this._cullMode = value;
        switch (this._cullMode) {
            case CullMode.Off:
                // 両面を描画する
                this.backFaceCulling = false;
                this.sideOrientation = Material.ClockWiseSideOrientation;
                this.twoSidedLighting = true;
                break;
            case CullMode.Front:
                // 表面を描画しない(=裏面だけ描画する)
                this.backFaceCulling = true;
                this.sideOrientation = Material.CounterClockWiseSideOrientation;
                this.twoSidedLighting = false;
                break;
            case CullMode.Back:
                // 裏面を描画しない(=表面だけ描画する) デフォルト
                this.backFaceCulling = true;
                this.sideOrientation = Material.ClockWiseSideOrientation;
                this.twoSidedLighting = false;
                break;
        }
        this.markAsDirty(Material.TextureDirtyFlag);
    }

    @serialize("outlineCullMode")
    private _outlineCullMode = CullMode.Front;
    @expandToProperty("_markAllSubMeshesAsMiscDirty")
    public outlineCullMode: CullMode = CullMode.Front;
    private storedCullMode = CullMode.Back;

    /**
     * アウトライン用 CullMode を設定
     * @hidden
     */
    public applyOutlineCullMode(): void {
        this.storedCullMode = this.cullMode;
        this.cullMode = this._outlineCullMode;
    }

    /**
     * CullMode をリストア
     * @hidden
     */
    public restoreOutlineCullMode(): void {
        this.cullMode = this.storedCullMode;
    }

    /**
     * @hidden
     */
    public getOutlineRendererName(): string {
        return this.outlineRenderer ? this.outlineRenderer.name : "";
    }
//#endregion
//#endregion

    /**
     * Instantiates a new MToon material.
     * @see https://vrm.dev/en/docs/univrm/shaders/shader_mtoon/
     * @param name Define the name of the material in the scene
     * @param scene Define the scene the material belong to
     */
    public constructor(name: string, scene: Scene) {
        super(name, scene);

        this.prePassConfiguration = new PrePassConfiguration();

        // シェーダストアに登録する
        if (!Effect.ShadersStore.mtoonVertexShader || !Effect.ShadersStore.mtoonFragmentShader) {
            Effect.IncludesShadersStore.mtoonUboDeclaration = UboDeclaration;
            Effect.IncludesShadersStore.mtoonVertexDeclaration = VertexDeclaration;
            Effect.IncludesShadersStore.mtoonFragmentDeclaration = FragmentDeclaration;
            Effect.IncludesShadersStore.mtoonLightFragment = LightFragment;
            Effect.IncludesShadersStore.mtoonBumpFragment = BumpFragment;
            Effect.ShadersStore.mtoonVertexShader = VertexShader;
            Effect.ShadersStore.mtoonFragmentShader = FragmentShader;
        }

        // Append custom inspectors
        this.inspectableCustomProperties = this.inspectableCustomProperties ?
            this.inspectableCustomProperties.concat(getInspectableCustomProperties())
            : getInspectableCustomProperties();
    }

    /**
     * Gets the current class name of the material e.g. "StandardMaterial"
     * Mainly use in serialization.
     * @returns the class name
     */
    public getClassName(): string {
        return "MToonMaterial";
    }

    /**
     * In case the depth buffer does not allow enough depth precision for your scene (might be the case in large scenes)
     * You can try switching to logarithmic depth.
     * @see https://doc.babylonjs.com/how_to/using_logarithmic_depth_buffer
     */
    @serialize()
    public get useLogarithmicDepth(): boolean {
        return this._useLogarithmicDepth;
    }
    public set useLogarithmicDepth(value: boolean) {
        this._useLogarithmicDepth = value && this.getScene().getEngine().getCaps().fragmentDepthSupported;

        this._markAllSubMeshesAsMiscDirty();
    }

    /**
     * Specifies if the material will require alpha blending
     * @returns a boolean specifying if alpha blending is needed
     */
    public needAlphaBlending(): boolean {
        if (this._disableAlphaBlending) {
            return false;
        }

        return (this.alpha < 1.0) || this._shouldUseAlphaFromDiffuseTexture();
    }

    /**
     * Specifies if this material should be rendered in alpha test mode
     * @returns a boolean specifying if an alpha test is needed.
     */
    public needAlphaTesting(): boolean {
        if (this._forceAlphaTest) {
            return true;
        }

        return this._hasAlphaChannel() && (this._transparencyMode == null || this._transparencyMode === Material.MATERIAL_ALPHATEST);
    }

    /**
     * Specifies whether or not the alpha value of the diffuse texture should be used for alpha blending.
     */
    protected _shouldUseAlphaFromDiffuseTexture(): boolean {
        return this._diffuseTexture !== null && this._diffuseTexture.hasAlpha && this._useAlphaFromDiffuseTexture && this._transparencyMode !== Material.MATERIAL_OPAQUE;
    }

    /**
     * Specifies whether or not there is a usable alpha channel for transparency.
     */
    protected _hasAlphaChannel(): boolean {
        return (this._diffuseTexture !== null && this._diffuseTexture.hasAlpha);
    }

    /**
     * Get the texture used for alpha test purpose.
     * @returns the diffuse texture in case of the standard material.
     */
    public getAlphaTestTexture(): Nullable<BaseTexture> {
        return this._diffuseTexture;
    }

    /**
     * Get if the submesh is ready to be used and all its information available.
     * Child classes can use it to update shaders
     * @param mesh defines the mesh to check
     * @param subMesh defines which submesh to check
     * @param useInstances specifies that instances should be used
     * @returns a boolean indicating that the submesh is ready or not
     */
    public isReadyForSubMesh(mesh: AbstractMesh, subMesh: SubMesh, useInstances: boolean = false): boolean {
        if (subMesh.effect && this.isFrozen) {
            if (subMesh.effect._wasPreviouslyReady) {
                return true;
            }
        }

        if (!subMesh._materialDefines) {
            subMesh.materialDefines = new MToonMaterialDefines();
        }

        const scene = this.getScene();
        const defines = <MToonMaterialDefines>subMesh._materialDefines;
        if (this._isReadyForSubMesh(subMesh)) {
            return true;
        }

        const engine = scene.getEngine();

        // Lights
        defines._needNormals = MaterialHelper.PrepareDefinesForLights(
            scene,
            mesh,
            defines,
            true,
            this._maxSimultaneousLights,
            this._disableLighting
        ) || (this.outlineWidthMode !== OutlineWidthMode.None);

        // Multiview
        MaterialHelper.PrepareDefinesForMultiview(scene, defines);

        // PrePass
        MaterialHelper.PrepareDefinesForPrePass(scene, defines, this.canRenderToMRT);

        // Textures
        if (defines._areTexturesDirty) {
            this.applyDefines(defines);

            defines._needUVs = false;
            for (let i = 1; i <= Constants.MAX_SUPPORTED_UV_SETS; ++i) {
                defines["MAINUV" + i] = false;
            }
            if (scene.texturesEnabled) {
                if (this._diffuseTexture && MToonMaterial.DiffuseTextureEnabled) {
                    if (!this._diffuseTexture.isReadyOrNotBlocking()) {
                        return false;
                    } else {
                        MaterialHelper.PrepareDefinesForMergedUV(this._diffuseTexture, defines, "DIFFUSE");
                    }
                } else {
                    defines.DIFFUSE = false;
                }

                if (this._ambientTexture && MToonMaterial.AmbientTextureEnabled) {
                    if (!this._ambientTexture.isReadyOrNotBlocking()) {
                        return false;
                    } else {
                        MaterialHelper.PrepareDefinesForMergedUV(this._ambientTexture, defines, "AMBIENT");
                    }
                } else {
                    defines.AMBIENT = false;
                }

                if (this._emissiveTexture && MToonMaterial.EmissiveTextureEnabled) {
                    if (!this._emissiveTexture.isReadyOrNotBlocking()) {
                        return false;
                    } else {
                        MaterialHelper.PrepareDefinesForMergedUV(this._emissiveTexture, defines, "EMISSIVE");
                    }
                } else {
                    defines.EMISSIVE = false;
                }

                if (this._specularTexture && MToonMaterial.SpecularTextureEnabled) {
                    if (!this._specularTexture.isReadyOrNotBlocking()) {
                        return false;
                    } else {
                        MaterialHelper.PrepareDefinesForMergedUV(this._specularTexture, defines, "SPECULAR");
                        defines.GLOSSINESS = this._useGlossinessFromSpecularMapAlpha;
                    }
                } else {
                    defines.SPECULAR = false;
                }

                if (scene.getEngine().getCaps().standardDerivatives && this._bumpTexture) {
                    // Bump texture can not be not blocking.
                    if (!this._bumpTexture.isReady()) {
                        return false;
                    } else {
                        MaterialHelper.PrepareDefinesForMergedUV(this._bumpTexture, defines, "BUMP");

                        defines.PARALLAX = this._useParallax;
                        defines.PARALLAXOCCLUSION = this._useParallaxOcclusion;
                    }

                    defines.OBJECTSPACE_NORMALMAP = this._useObjectSpaceNormalMap;
                } else {
                    defines.BUMP = false;
                }

                if (this._shadeTexture) {
                    if (!this._shadeTexture.isReadyOrNotBlocking()) {
                        return false;
                    } else {
                        MaterialHelper.PrepareDefinesForMergedUV(this._shadeTexture, defines, "SHADE");
                    }
                } else {
                    defines.SHADE = false;
                }

                if (this._receiveShadowTexture) {
                    if (!this._receiveShadowTexture.isReadyOrNotBlocking()) {
                        return false;
                    } else {
                        MaterialHelper.PrepareDefinesForMergedUV(this._receiveShadowTexture, defines, "RECEIVE_SHADOW");
                    }
                } else {
                    defines.RECEIVE_SHADOW = false;
                }

                if (this._shadingGradeTexture) {
                    if (!this._shadingGradeTexture.isReadyOrNotBlocking()) {
                        return false;
                    } else {
                        MaterialHelper.PrepareDefinesForMergedUV(this._shadingGradeTexture, defines, "SHADING_GRADE");
                    }
                } else {
                    defines.SHADING_GRADE = false;
                }

                if (this._rimTexture) {
                    if (!this._rimTexture.isReadyOrNotBlocking()) {
                        return false;
                    } else {
                        MaterialHelper.PrepareDefinesForMergedUV(this._rimTexture, defines, "RIM");
                    }
                } else {
                    defines.RIM = false;
                }

                if (this._matCapTexture) {
                    if (!this._matCapTexture.isReadyOrNotBlocking()) {
                        return false;
                    } else {
                        MaterialHelper.PrepareDefinesForMergedUV(this._matCapTexture, defines, "MATCAP");
                    }
                } else {
                    defines.MATCAP = false;
                }

                if (this._outlineWidthTexture) {
                    if (!this._outlineWidthTexture.isReadyOrNotBlocking()) {
                        return false;
                    } else {
                        MaterialHelper.PrepareDefinesForMergedUV(this._outlineWidthTexture, defines, "OUTLINE_WIDTH");
                    }
                } else {
                    defines.OUTLINE_WIDTH = false;
                }

                if (this._uvAnimationMaskTexture) {
                    if (!this._uvAnimationMaskTexture.isReadyOrNotBlocking()) {
                        return false;
                    } else {
                        MaterialHelper.PrepareDefinesForMergedUV(this._uvAnimationMaskTexture, defines, "UV_ANIMATION_MASK");
                    }
                } else {
                    defines.UV_ANIMATION_MASK = false;
                }

                defines.TWOSIDEDLIGHTING = !this._backFaceCulling && this._twoSidedLighting;
            } else {
                defines.DIFFUSE = false;
                defines.AMBIENT = false;
                defines.EMISSIVE = false;
                defines.BUMP = false;
                defines.SHADE = false;
                defines.RECEIVE_SHADOW = false;
                defines.SHADING_GRADE = false;
                defines.RIM = false;
                defines.MATCAP = false;
                defines.OUTLINE_WIDTH = false;
                defines.UV_ANIMATION_MASK = false;
            }

            defines.ALPHAFROMDIFFUSE = this._shouldUseAlphaFromDiffuseTexture();

            defines.EMISSIVEASILLUMINATION = this._useEmissiveAsIllumination;

            defines.LINKEMISSIVEWITHDIFFUSE = this._linkEmissiveWithDiffuse;

            defines.SPECULAROVERALPHA = this._useSpecularOverAlpha;

            defines.PREMULTIPLYALPHA = (this.alphaMode === Constants.ALPHA_PREMULTIPLIED || this.alphaMode === Constants.ALPHA_PREMULTIPLIED_PORTERDUFF);

            defines.ALPHATEST_AFTERALLALPHACOMPUTATIONS = this.transparencyMode !== null;

            defines.ALPHABLEND = this.transparencyMode === null || this.needAlphaBlendingForMesh(mesh); // check on null for backward compatibility
        }

        if (!this.detailMap.isReadyForSubMesh(defines, scene)) {
            return false;
        }

        // Misc.
        MaterialHelper.PrepareDefinesForMisc(
            mesh,
            scene,
            this._useLogarithmicDepth,
            this.pointsCloud,
            this.fogEnabled,
            this._shouldTurnAlphaTestOn(mesh) || this._forceAlphaTest,
            defines
        );

        // Attribs
        MaterialHelper.PrepareDefinesForAttributes(
            mesh,
            defines,
            this.useVertexColor,
            this.useBones,
            this.useMorphTargets,
            this.useVertexAlpha,
        );

        // Values that need to be evaluated on every frame
        MaterialHelper.PrepareDefinesForFrameBoundValues(
            scene,
            engine,
            defines,
            useInstances,
            null,
            subMesh.getRenderingMesh().hasThinInstances
        );

        // External config
        this.detailMap.prepareDefines(defines, scene);

        // Get correct effect
        if (defines.isDirty) {
            const lightDisposed = defines._areLightsDisposed;
            defines.markAsProcessed();

            // Fallbacks
            const fallbacks = new EffectFallbacks();
            if (defines.SPECULAR) {
                fallbacks.addFallback(0, "SPECULAR");
            }

            if (defines.BUMP) {
                fallbacks.addFallback(0, "BUMP");
            }

            if (defines.PARALLAX) {
                fallbacks.addFallback(1, "PARALLAX");
            }

            if (defines.PARALLAXOCCLUSION) {
                fallbacks.addFallback(0, "PARALLAXOCCLUSION");
            }

            if (defines.SPECULAROVERALPHA) {
                fallbacks.addFallback(0, "SPECULAROVERALPHA");
            }

            if (defines.FOG) {
                fallbacks.addFallback(1, "FOG");
            }

            if (defines.POINTSIZE) {
                fallbacks.addFallback(0, "POINTSIZE");
            }

            if (defines.LOGARITHMICDEPTH) {
                fallbacks.addFallback(0, "LOGARITHMICDEPTH");
            }

            MaterialHelper.HandleFallbacksForShadows(defines, fallbacks, this._maxSimultaneousLights);

            if (defines.SPECULARTERM) {
                fallbacks.addFallback(0, "SPECULARTERM");
            }

            if (defines.MULTIVIEW) {
                fallbacks.addFallback(0, "MULTIVIEW");
            }

            // Attributes
            const attribs = [VertexBuffer.PositionKind];

            if (defines.NORMAL) {
                attribs.push(VertexBuffer.NormalKind);
            }

            if (defines.TANGENT) {
                attribs.push(VertexBuffer.TangentKind);
            }

            for (let i = 1; i <= Constants.MAX_SUPPORTED_UV_SETS; ++i) {
                if (defines["UV" + i]) {
                    attribs.push(`uv${i === 1 ? "" : i}`);
                }
            }

            if (defines.VERTEXCOLOR) {
                attribs.push(VertexBuffer.ColorKind);
            }

            MaterialHelper.PrepareAttributesForBones(attribs, mesh, defines, fallbacks);
            MaterialHelper.PrepareAttributesForInstances(attribs, defines);
            MaterialHelper.PrepareAttributesForMorphTargets(attribs, mesh, defines);

            let shaderName = "mtoon";

            const uniforms = ["world", "view", "viewProjection", "vEyePosition", "vLightsType",
                "vAmbientColor", "vDiffuseColor", "vSpecularColor", "vEmissiveColor", "visibility",
                "vFogInfos", "vFogColor", "pointSize",
                "vDiffuseInfos", "vAmbientInfos", "vEmissiveInfos", "vSpecularInfos", "vBumpInfos",
                "mBones",
                "vClipPlane", "vClipPlane2", "vClipPlane3", "vClipPlane4", "vClipPlane5", "vClipPlane6",
                "diffuseMatrix", "ambientMatrix", "emissiveMatrix", "specularMatrix", "bumpMatrix",
                "logarithmicDepthConstant", "vTangentSpaceParams", "alphaCutOff", "boneTextureWidth",

                "vShadeColor", "vShadeInfos", "shadeMatrix",
                "vReceiveShadowInfos", "receiveShadowMatrix",
                "vShadingGradeInfos", "shadingGradeMatrix",
                "vRimColor", "vRimInfos", "RimMatrix",
                "vMatCapInfos", "MatCapMatrix",
                "vOutlineColor", "vOutlineWidthInfos", "outlineWidthMatrix",
                "aspect", "isOutline",

                "shadingGradeRate", "receiveShadowRate", "shadeShift", "shadeToony",
                "rimLightingMix", "rimFresnelPower", "rimLift",
                "lightColorAttenuation", "indirectLightIntensity",
                "outlineWidth", "outlineScaledMaxDistance", "outlineLightingMix",
                "uvAnimationScrollX", "uvAnimationScrollY", "uvAnimationRotation",

                "vEyeUp", "time",

                "morphTargetTextureInfo", "morphTargetTextureIndices"
            ];

            const samplers = ["diffuseSampler", "ambientSampler", "emissiveSampler",
                "specularSampler", "bumpSampler", "boneSampler",
                "shadeSampler", "receiveShadowSampler", "shadingGradeSampler",
                "rimSampler", "matCapSampler", "outlineWidthSampler",
                "uvAnimationMaskSampler", "morphTargets",
            ];

            const uniformBuffers = ["Material", "Scene"];

            DetailMapConfiguration.AddUniforms(uniforms);
            DetailMapConfiguration.AddSamplers(samplers);

            PrePassConfiguration.AddUniforms(uniforms);
            PrePassConfiguration.AddSamplers(samplers);

            MaterialHelper.PrepareUniformsAndSamplersList(<IEffectCreationOptions>{
                uniformsNames: uniforms,
                uniformBuffersNames: uniformBuffers,
                samplers: samplers,
                defines: defines,
                maxSimultaneousLights: this._maxSimultaneousLights
            });

            const csnrOptions: ICustomShaderNameResolveOptions = {};

            if (this.customShaderNameResolve) {
                shaderName = this.customShaderNameResolve(shaderName, uniforms, uniformBuffers, samplers, defines, attribs, csnrOptions);
            }

            const join = defines.toString();

            const previousEffect = subMesh.effect;
            let effect = scene.getEngine().createEffect(shaderName, <IEffectCreationOptions>{
                attributes: attribs,
                uniformsNames: uniforms,
                uniformBuffersNames: uniformBuffers,
                samplers: samplers,
                defines: join,
                fallbacks: fallbacks,
                onCompiled: this.onCompiled,
                onError: this.onError,
                indexParameters: {
                    maxSimultaneousLights: this._maxSimultaneousLights,
                    maxSimultaneousMorphTargets: defines.NUM_MORPH_INFLUENCERS
                },
                processFinalCode: csnrOptions.processFinalCode,
                multiTarget: defines.PREPASS
            }, engine);

            if (effect) {
                if (this._onEffectCreatedObservable) {
                    onCreatedEffectParameters.effect = effect;
                    onCreatedEffectParameters.subMesh = subMesh;
                    this._onEffectCreatedObservable.notifyObservers(onCreatedEffectParameters);
                }
                // Use previous effect while new one is compiling
                if (this.allowShaderHotSwapping && previousEffect && !effect.isReady()) {
                    effect = previousEffect;
                    defines.markAsUnprocessed();

                    if (lightDisposed) {
                        // re register in case it takes more than one frame.
                        defines._areLightsDisposed = true;
                        return false;
                    }
                } else {
                    scene.resetCachedMaterial();
                    subMesh.setEffect(effect, defines, this._materialContext);
                    this.buildUniformLayout();
                }
            }
        }

        if (!subMesh.effect || !subMesh.effect.isReady()) {
            return false;
        }

        defines._renderId = scene.getRenderId();
        subMesh.effect._wasPreviouslyReady = true;

        return true;
    }

    /**
     * Builds the material UBO layouts.
     * Used internally during the effect preparation.
     */
    public buildUniformLayout(): void {
        // Order is important !
        const ubo = this._uniformBuffer;

        ubo.addUniform("vDiffuseColor", 4);
        ubo.addUniform("vDiffuseInfos", 2);
        ubo.addUniform("diffuseMatrix", 16);

        ubo.addUniform("vSpecularColor", 4);
        ubo.addUniform("vSpecularInfos", 2);
        ubo.addUniform("specularMatrix", 16);

        ubo.addUniform("vAmbientColor", 3);
        ubo.addUniform("vAmbientInfos", 2);
        ubo.addUniform("ambientMatrix", 16);

        ubo.addUniform("vEmissiveColor", 3);
        ubo.addUniform("vEmissiveInfos", 2);
        ubo.addUniform("emissiveMatrix", 16);

        ubo.addUniform("vBumpInfos", 3);
        ubo.addUniform("bumpMatrix", 16);

        ubo.addUniform("vShadeColor", 3);
        ubo.addUniform("vShadeInfos", 2);
        ubo.addUniform("shadeMatrix", 16);

        ubo.addUniform("vReceiveShadowInfos", 2);
        ubo.addUniform("receiveShadowMatrix", 16);

        ubo.addUniform("vShadingGradeInfos", 2);
        ubo.addUniform("shadingGradeMatrix", 16);

        ubo.addUniform("vRimColor", 3);
        ubo.addUniform("vRimInfos", 2);
        ubo.addUniform("rimMatrix", 16);

        ubo.addUniform("vMatCapInfos", 2);
        ubo.addUniform("matCapMatrix", 16);

        ubo.addUniform("vOutlineColor", 3);
        ubo.addUniform("vOutlineWidthInfos", 2);
        ubo.addUniform("outlineWidthMatrix", 16);

        ubo.addUniform("vUvAnimationMaskInfos", 2);
        ubo.addUniform("uvAnimationMaskMatrix", 16);

        ubo.addUniform("vTangentSpaceParams", 2);
        ubo.addUniform("pointSize", 1);
        ubo.addUniform("alphaCutOff", 1);

        ubo.addUniform("shadingGradeRate", 1);
        ubo.addUniform("receiveShadowRate", 1);
        ubo.addUniform("shadeShift", 1);
        ubo.addUniform("shadeToony", 1);
        ubo.addUniform("lightColorAttenuation", 1);
        ubo.addUniform("indirectLightIntensity", 1);
        ubo.addUniform("rimLightingMix", 1);
        ubo.addUniform("rimFresnelPower", 1);
        ubo.addUniform("rimLift", 1);
        ubo.addUniform("outlineWidth", 1);
        ubo.addUniform("outlineScaledMaxDistance", 1);
        ubo.addUniform("outlineLightingMix", 1);
        ubo.addUniform("uvAnimationScrollX", 1);
        ubo.addUniform("uvAnimationScrollY", 1);
        ubo.addUniform("uvAnimationRotation", 1);

        DetailMapConfiguration.PrepareUniformBuffer(ubo);

        ubo.create();
    }

    /**
     * Unbinds the material from the mesh
     */
    public unbind(): void {
        super.unbind();
    }

    /**
     * Binds the submesh to this material by preparing the effect and shader to draw
     * @param world defines the world transformation matrix
     * @param mesh defines the mesh containing the submesh
     * @param subMesh defines the submesh to bind the material to
     */
    public bindForSubMesh(world: Matrix, mesh: Mesh, subMesh: SubMesh): void {
        const scene = this.getScene();

        const defines = <MToonMaterialDefines>subMesh._materialDefines;
        if (!defines) {
            return;
        }

        const effect = subMesh.effect;
        if (!effect) {
            return;
        }
        this._activeEffect = effect;

        // Matrices Mesh.
        mesh.getMeshUniformBuffer().bindToEffect(effect, "Mesh");
        mesh.transferToEffect(world);

        // PrePass
        this.prePassConfiguration.bindForSubMesh(this._activeEffect, scene, mesh, world, this.isFrozen);

        // Normal Matrix
        if (defines.OBJECTSPACE_NORMALMAP) {
            world.toNormalMatrix(this._normalMatrix);
            this.bindOnlyNormalMatrix(this._normalMatrix);
        }

        const mustRebind = this._mustRebind(scene, effect, mesh.visibility);

        // Bones
        MaterialHelper.BindBonesParameters(mesh, effect);
        const ubo = this._uniformBuffer;
        if (mustRebind) {
            ubo.bindToEffect(effect, "Material");

            this.bindViewProjection(effect);
            if (!ubo.useUbo || !this.isFrozen || !ubo.isSync) {
                // Textures
                if (scene.texturesEnabled) {
                    if (this._diffuseTexture && MToonMaterial.DiffuseTextureEnabled) {
                        ubo.updateFloat2("vDiffuseInfos", this._diffuseTexture.coordinatesIndex, this._diffuseTexture.level);
                        MaterialHelper.BindTextureMatrix(this._diffuseTexture, ubo, "diffuse");
                    }

                    if (this._ambientTexture && MToonMaterial.AmbientTextureEnabled) {
                        ubo.updateFloat2("vAmbientInfos", this._ambientTexture.coordinatesIndex, this._ambientTexture.level);
                        MaterialHelper.BindTextureMatrix(this._ambientTexture, ubo, "ambient");
                    }

                    if (this._hasAlphaChannel()) {
                        ubo.updateFloat("alphaCutOff", this.alphaCutOff);
                    }

                    if (this._emissiveTexture && MToonMaterial.EmissiveTextureEnabled) {
                        ubo.updateFloat2("vEmissiveInfos", this._emissiveTexture.coordinatesIndex, this._emissiveTexture.level);
                        MaterialHelper.BindTextureMatrix(this._emissiveTexture, ubo, "emissive");
                    }

                    if (this._specularTexture && MToonMaterial.SpecularTextureEnabled) {
                        ubo.updateFloat2("vSpecularInfos", this._specularTexture.coordinatesIndex, this._specularTexture.level);
                        MaterialHelper.BindTextureMatrix(this._specularTexture, ubo, "specular");
                    }

                    if (this._bumpTexture && scene.getEngine().getCaps().standardDerivatives && MToonMaterial.BumpTextureEnabled) {
                        ubo.updateFloat3("vBumpInfos", this._bumpTexture.coordinatesIndex, 1.0 / this._bumpTexture.level, this.parallaxScaleBias);
                        MaterialHelper.BindTextureMatrix(this._bumpTexture, ubo, "bump");

                        if (scene._mirroredCameraPosition) {
                            ubo.updateFloat2("vTangentSpaceParams", -1.0, -1.0);
                        } else {
                            ubo.updateFloat2("vTangentSpaceParams", 1.0, 1.0);
                        }
                    }

                    if (this._shadeTexture) {
                        ubo.updateFloat2("vShadeInfos", this._shadeTexture.coordinatesIndex, this._shadeTexture.level);
                        MaterialHelper.BindTextureMatrix(this._shadeTexture, ubo, "shade");
                    }

                    if (this._receiveShadowTexture) {
                        ubo.updateFloat2("vReceiveShadowInfos", this._receiveShadowTexture.coordinatesIndex, this._receiveShadowTexture.level);
                        MaterialHelper.BindTextureMatrix(this._receiveShadowTexture, ubo, "receiveShadow");
                    }

                    if (this._shadingGradeTexture) {
                        ubo.updateFloat2("vShadingGradeInfos", this._shadingGradeTexture.coordinatesIndex, this._shadingGradeTexture.level);
                        MaterialHelper.BindTextureMatrix(this._shadingGradeTexture, ubo, "shadingGrade");
                    }

                    if (this._rimTexture) {
                        ubo.updateFloat2("vRimInfos", this._rimTexture.coordinatesIndex, this._rimTexture.level);
                        MaterialHelper.BindTextureMatrix(this._rimTexture, ubo, "rim");
                    }

                    if (this._matCapTexture) {
                        ubo.updateFloat2("vMatCapInfos", this._matCapTexture.coordinatesIndex, this._matCapTexture.level);
                        MaterialHelper.BindTextureMatrix(this._matCapTexture, ubo, "matCap");
                    }

                    if (this._outlineWidthTexture) {
                        ubo.updateFloat2("vOutlineWidthInfos", this._outlineWidthTexture.coordinatesIndex, this._outlineWidthTexture.level);
                        MaterialHelper.BindTextureMatrix(this._outlineWidthTexture, ubo, "outlineWidth");
                    }

                    if (this._uvAnimationMaskTexture) {
                        ubo.updateFloat2("vUvAnimationMaskInfos", this._uvAnimationMaskTexture.coordinatesIndex, this._uvAnimationMaskTexture.level);
                        MaterialHelper.BindTextureMatrix(this._uvAnimationMaskTexture, ubo, "uvAnimationMask");
                    }
                }
            }

            // Point size
            if (this.pointsCloud) {
                ubo.updateFloat("pointSize", this.pointSize);
            }

            if (defines.SPECULARTERM) {
                ubo.updateColor4("vSpecularColor", this.specularColor, this.specularPower);
            }

            ubo.updateColor3("vEmissiveColor", this.emissiveColor);
            ubo.updateColor4("vDiffuseColor", this.diffuseColor, this.alpha);

            scene.ambientColor.multiplyToRef(this.ambientColor, this._globalAmbientColor);
            ubo.updateColor3("vAmbientColor", this._globalAmbientColor);

            // MToon uniforms
            ubo.updateFloat("receiveShadowRate", this._receiveShadowRate);
            ubo.updateFloat("shadingGradeRate", this._shadingGradeRate);
            ubo.updateFloat("shadeShift", this._shadeShift);
            ubo.updateFloat("shadeToony", this._shadeToony);
            ubo.updateFloat("lightColorAttenuation", this._lightColorAttenuation);
            ubo.updateFloat("indirectLightIntensity", this._indirectLightIntensity);
            ubo.updateFloat("rimLightingMix", this._rimLightingMix);
            ubo.updateFloat("rimFresnelPower", this._rimFresnelPower);
            ubo.updateFloat("rimLift", this._rimLift);
            ubo.updateFloat("outlineWidth", this._outlineWidth);
            ubo.updateFloat("outlineScaledMaxDistance", this._outlineScaledMaxDistance);
            ubo.updateFloat("outlineLightingMix", this._outlineLightingMix);
            ubo.updateFloat("uvAnimationScrollX", this._uvAnimationScrollX);
            ubo.updateFloat("uvAnimationScrollY", this._uvAnimationScrollY);
            ubo.updateFloat("uvAnimationRotation", this._uvAnimationRotation);

            // Textures
            if (scene.texturesEnabled) {
                if (this._diffuseTexture && MToonMaterial.DiffuseTextureEnabled) {
                    effect.setTexture("diffuseSampler", this._diffuseTexture);
                }

                if (this._ambientTexture && MToonMaterial.AmbientTextureEnabled) {
                    effect.setTexture("ambientSampler", this._ambientTexture);
                }

                if (this._emissiveTexture && MToonMaterial.EmissiveTextureEnabled) {
                    effect.setTexture("emissiveSampler", this._emissiveTexture);
                }

                if (this._specularTexture && MToonMaterial.SpecularTextureEnabled) {
                    effect.setTexture("specularSampler", this._specularTexture);
                }

                if (this._bumpTexture && scene.getEngine().getCaps().standardDerivatives && MToonMaterial.BumpTextureEnabled) {
                    effect.setTexture("bumpSampler", this._bumpTexture);
                }

                if (this._shadeTexture) {
                    effect.setTexture("shadeSampler", this._shadeTexture);
                }

                if (this._receiveShadowTexture) {
                    effect.setTexture("receiveShadowSampler", this._receiveShadowTexture);
                }

                if (this._shadingGradeTexture) {
                    effect.setTexture("shadingGradeSampler", this._shadingGradeTexture);
                }

                if (this._rimTexture) {
                    effect.setTexture("rimSampler", this._rimTexture);
                }

                if (this._matCapTexture) {
                    effect.setTexture("matCapSampler", this._matCapTexture);
                }

                if (this._outlineWidthTexture) {
                    effect.setTexture("outlineWidthSampler", this._outlineWidthTexture);
                }

                if (this._uvAnimationMaskTexture) {
                    effect.setTexture("uvAnimationMaskSampler", this._uvAnimationMaskTexture);
                }
            }

            this.detailMap.bindForSubMesh(ubo, scene, this.isFrozen);

            // Clip plane
            MaterialHelper.BindClipPlane(effect, scene);

            // Colors
            this.bindEyePosition(effect);
            effect.setVector3("vEyeUp", scene.activeCamera!.upVector);
            ubo.updateColor3("vShadeColor", this.shadeColor);
            ubo.updateColor3("vRimColor", this.rimColor);
            ubo.updateColor4("vOutlineColor", this.outlineColor, 1.0);
        }

        if (mustRebind || !this.isFrozen) {
            // Lights
            if (scene.lightsEnabled && !this._disableLighting) {
                MaterialHelper.BindLights(scene, mesh, effect, defines, this._maxSimultaneousLights);
            }

            // View
            if (scene.fogEnabled && mesh.applyFog && scene.fogMode !== Scene.FOGMODE_NONE || mesh.receiveShadows) {
                this.bindView(effect);
            }

            // Fog
            MaterialHelper.BindFogParameters(scene, mesh, effect);

            // Morph targets
            if (defines.NUM_MORPH_INFLUENCERS) {
                MaterialHelper.BindMorphTargetParameters(mesh, effect);
            }

            // Log. depth
            if (this.useLogarithmicDepth) {
                MaterialHelper.BindLogDepth(defines, effect, scene);
            }
        }

        effect.setFloat("aspect", scene.getEngine().getAspectRatio(scene.activeCamera!));
        effect.setFloat("isOutline", 0);
        const t = window.performance.now() / 1000;
        effect.setVector4("time", new Vector4(
            t / 20,
            t,
            t * 2,
            t * 3,
        ));

        this._afterBind(mesh, this._activeEffect);
        ubo.update();
    }

    /**
     * Get the list of animatables in the material.
     * @returns the list of animatables object used in the material
     */
    public getAnimatables(): IAnimatable[] {
        const results: IAnimatable[] = [];

        for (const texture of this.appendedActiveTextures()) {
            if (texture.animations && texture.animations.length > 0) {
                results.push(texture);
            }
        }

        this.detailMap.getAnimatables(results);

        return results;
    }

    /**
     * Gets the active textures from the material
     * @returns an array of textures
     */
    public getActiveTextures(): BaseTexture[] {
        const activeTextures = super.getActiveTextures().concat(this.appendedActiveTextures());

        this.detailMap.getActiveTextures(activeTextures);

        return activeTextures;
    }

    /**
     * Specifies if the material uses a texture
     * @param texture defines the texture to check against the material
     * @returns a boolean specifying if the material uses the texture
     */
    public hasTexture(texture: BaseTexture): boolean {
        if (super.hasTexture(texture)) {
            return true;
        }

        const activeTextures = this.appendedActiveTextures();
        return activeTextures.length > 0 ?
            activeTextures.some((e) => e === texture)
            : this.detailMap.hasTexture(texture);
    }

    /**
     * Disposes the material
     * @param forceDisposeEffect specifies if effects should be forcefully disposed
     * @param forceDisposeTextures specifies if textures should be forcefully disposed
     */
    public dispose(
        forceDisposeEffect?: boolean,
        forceDisposeTextures?: boolean
    ): void {
        if (forceDisposeTextures) {
            this.appendedActiveTextures().forEach((e) => e.dispose());
        }

        this.detailMap.dispose(forceDisposeTextures);

        super.dispose(forceDisposeEffect, forceDisposeTextures);
    }

    /**
     * 定数を設定する
     */
    private applyDefines(defines: any): void {
        switch (this._debugMode) {
            case DebugMode.Normal:
                if (defines.MTOON_DEBUG_NORMAL !== true) {
                    defines.MTOON_DEBUG_NORMAL = true;
                    defines.MTOON_DEBUG_LITSHADERATE = false;
                    defines.markAsUnprocessed();
                }
                break;
            case DebugMode.LitShadeRate:
                if (defines.MTOON_DEBUG_LITSHADERATE !== true) {
                    defines.MTOON_DEBUG_NORMAL = false;
                    defines.MTOON_DEBUG_LITSHADERATE = true;
                    defines.markAsUnprocessed();
                }
                break;
            case DebugMode.None:
                if (defines.MTOON_DEBUG_NORMAL === true) {
                    defines.MTOON_DEBUG_NORMAL = false;
                    defines.markAsUnprocessed();
                }
                if (defines.MTOON_DEBUG_LITSHADERATE === true) {
                    defines.MTOON_DEBUG_LITSHADERATE = false;
                    defines.markAsUnprocessed();
                }
                break;
        }
        switch (this._outlineWidthMode) {
            case OutlineWidthMode.WorldCorrdinates:
                if (defines.MTOON_OUTLINE_WIDTH_WORLD !== true) {
                    defines.MTOON_OUTLINE_WIDTH_WORLD = true;
                    defines.MTOON_OUTLINE_WIDTH_SCREEN = false;
                    defines.markAsUnprocessed();
                }
                break;
            case OutlineWidthMode.ScreenCoordinates:
                if (defines.MTOON_OUTLINE_WIDTH_SCREEN !== true) {
                    defines.MTOON_OUTLINE_WIDTH_WORLD = false;
                    defines.MTOON_OUTLINE_WIDTH_SCREEN = true;
                    defines.markAsUnprocessed();
                }
                break;
            case OutlineWidthMode.None:
                if (defines.MTOON_OUTLINE_WIDTH_SCREEN !== false || defines.MTOON_OUTLINE_WIDTH_WORLD !== false) {
                    defines.MTOON_OUTLINE_WIDTH_SCREEN = false;
                    defines.MTOON_OUTLINE_WIDTH_WORLD = false;
                    defines.markAsUnprocessed();
                }
                break;
        }
        switch (this._outlineColorMode) {
            case OutlineColorMode.FixedColor:
                if (defines.MTOON_OUTLINE_COLOR_FIXED !== true) {
                    defines.MTOON_OUTLINE_COLOR_FIXED = true;
                    defines.MTOON_OUTLINE_COLOR_MIXED = false;
                    defines.markAsUnprocessed();
                }
                break;
            case OutlineColorMode.MixedLighting:
                if (defines.MTOON_OUTLINE_COLOR_MIXED !== true) {
                    defines.MTOON_OUTLINE_COLOR_FIXED = false;
                    defines.MTOON_OUTLINE_COLOR_MIXED = true;
                    defines.markAsUnprocessed();
                }
                break;
        }
    }

//#region Misc
    /**
     * Makes a duplicate of the material, and gives it a new name
     * @param name defines the new name for the duplicated material
     * @returns the cloned material
     */
    public clone(name: string): MToonMaterial {
        const result = SerializationHelper.Clone(() => new MToonMaterial(name, this.getScene()), this);

        result.name = name;
        result.id = name;

        this.stencil.copyTo(result.stencil);

        return result;
    }

    /**
     * Serializes this material in a JSON representation
     * @returns the serialized material object
     */
    public serialize(): any {
        const serializationObject = SerializationHelper.Serialize(this);

        serializationObject.stencil = this.stencil.serialize();

        return serializationObject;
    }

    /**
     * Creates a standard material from parsed material data
     * @param source defines the JSON representation of the material
     * @param scene defines the hosting scene
     * @param rootUrl defines the root URL to use to load textures and relative dependencies
     * @returns a new standard material
     */
    public static Parse(source: any, scene: Scene, rootUrl: string): MToonMaterial {
        const material = SerializationHelper.Parse(() => new MToonMaterial(source.name, scene), source, scene, rootUrl);

        if (source.stencil) {
            material.stencil.parse(source.stencil, scene, rootUrl);
        }

        return material;
    }
//#endregion

    // Flags used to enable or disable a type of texture for all Standard Materials
    /**
     * Are diffuse textures enabled in the application.
     */
    public static get DiffuseTextureEnabled(): boolean {
        return MaterialFlags.DiffuseTextureEnabled;
    }
    public static set DiffuseTextureEnabled(value: boolean) {
        MaterialFlags.DiffuseTextureEnabled = value;
    }

    /**
     * Are ambient textures enabled in the application.
     */
    public static get AmbientTextureEnabled(): boolean {
        return MaterialFlags.AmbientTextureEnabled;
    }
    public static set AmbientTextureEnabled(value: boolean) {
        MaterialFlags.AmbientTextureEnabled = value;
    }

    /**
     * Are emissive textures enabled in the application.
     */
    public static get EmissiveTextureEnabled(): boolean {
        return MaterialFlags.EmissiveTextureEnabled;
    }
    public static set EmissiveTextureEnabled(value: boolean) {
        MaterialFlags.EmissiveTextureEnabled = value;
    }

    /**
     * Are specular textures enabled in the application.
     */
    public static get SpecularTextureEnabled(): boolean {
        return MaterialFlags.SpecularTextureEnabled;
    }
    public static set SpecularTextureEnabled(value: boolean) {
        MaterialFlags.SpecularTextureEnabled = value;
    }

    /**
     * Are bump textures enabled in the application.
     */
    public static get BumpTextureEnabled(): boolean {
        return MaterialFlags.BumpTextureEnabled;
    }
    public static set BumpTextureEnabled(value: boolean) {
        MaterialFlags.BumpTextureEnabled = value;
    }

}

_TypeStore.RegisteredTypes["BABYLON.MToonMaterial"] = MToonMaterial;
