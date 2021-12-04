import { Constants } from '@babylonjs/core/Engines/constants';
import { Effect, IEffectCreationOptions } from '@babylonjs/core/Materials/effect';
import { EffectFallbacks } from '@babylonjs/core/Materials/effectFallbacks';
import { ICustomShaderNameResolveOptions, Material } from '@babylonjs/core/Materials/material';
import { MaterialHelper } from '@babylonjs/core/Materials/materialHelper';
import { PushMaterial } from '@babylonjs/core/Materials/pushMaterial';
import { BaseTexture } from '@babylonjs/core/Materials/Textures/baseTexture';
import { Color3, Matrix, Vector4 } from '@babylonjs/core/Maths/math';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { VertexBuffer } from '@babylonjs/core/Meshes/buffer';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { SubMesh } from '@babylonjs/core/Meshes/subMesh';
import { expandToProperty, SerializationHelper, serialize, serializeAsColor3, serializeAsTexture } from '@babylonjs/core/Misc/decorators';
import { IAnimatable } from '@babylonjs/core/Animations/animatable.interface';
import { Scene } from '@babylonjs/core/scene';
import { Nullable } from '@babylonjs/core/types';
import { PrePassConfiguration } from '@babylonjs/core/Materials/prePassConfiguration';
import { DetailMapConfiguration } from '@babylonjs/core/Materials/material.detailMapConfiguration';
import { getInspectableCustomProperties } from './inspectable-custom-properties';
import { MToonMaterialDefines } from './mtoon-material-defines';
import { MToonOutlineRenderer } from './mtoon-outline-renderer';

// シェーダ文字列を取得
const UboDeclaration = require('./shaders/ubo-declaration.vert').default;
const VertexDeclaration = require('./shaders/vertex-declaration.vert').default;
const FragmentDeclaration = require('./shaders/fragment-declaration.frag').default;
const BumpFragment = require('./shaders/bump-fragment.frag').default;
const LightFragment = require('./shaders/light-fragment.frag').default;
const VertexShader = require('./shaders/mtoon.vert').default;
const FragmentShader = require('./shaders/mtoon.frag').default;

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
    @serializeAsTexture('diffuseTexture')
    private _diffuseTexture: Nullable<BaseTexture> = null;
    /**
     * 通常色テクスチャ
     */
    @expandToProperty('_markAllSubMeshesAsTexturesAndMiscDirty')
    public diffuseTexture: Nullable<BaseTexture> = null;

    @serializeAsTexture('emissiveTexture')
    private _emissiveTexture: Nullable<BaseTexture> = null;
    /**
     * 発光テクスチャ
     */
    @expandToProperty('_markAllSubMeshesAsTexturesDirty')
    public emissiveTexture: Nullable<BaseTexture> = null;

    @serializeAsTexture('bumpTexture')
    private _bumpTexture: Nullable<BaseTexture> = null;
    /**
     * バンプマップテクスチャ
     */
    @expandToProperty('_markAllSubMeshesAsTexturesDirty')
    public bumpTexture: Nullable<BaseTexture> = null;

    @serializeAsTexture('shadeTexture')
    private _shadeTexture: Nullable<BaseTexture> = null;
    /**
     * 陰になる部分の色テクスチャ
     */
    @expandToProperty('_markAllSubMeshesAsTexturesDirty')
    public shadeTexture: Nullable<BaseTexture> = null;

    @serializeAsTexture('receiveShadowTexture')
    private _receiveShadowTexture: Nullable<BaseTexture> = null;
    /**
     * どれだけ影を受け付けるかのテクスチャ
     * receiveShadowRate * texture.a
     */
    @expandToProperty('_markAllSubMeshesAsTexturesDirty')
    public receiveShadowTexture: Nullable<BaseTexture> = null;

    @serializeAsTexture('shadingGradeTexture')
    private _shadingGradeTexture: Nullable<BaseTexture> = null;
    /**
     * 陰部分の暗さテクスチャ
     * shadingGradeRate * (1.0 - texture.r))
     */
    @expandToProperty('_markAllSubMeshesAsTexturesDirty')
    public shadingGradeTexture: Nullable<BaseTexture> = null;

    @serializeAsTexture('rimTexture')
    private _rimTexture: Nullable<BaseTexture> = null;
    /**
     * Parametric Rim Lighting テクスチャ
     */
    @expandToProperty('_markAllSubMeshesAsTexturesDirty')
    public rimTexture: Nullable<BaseTexture> = null;

    @serializeAsTexture('matCapTexture')
    private _matCapTexture: Nullable<BaseTexture> = null;
    /**
     * MatCap ライティングテクスチャ
     */
    @expandToProperty('_markAllSubMeshesAsTexturesDirty')
    public matCapTexture: Nullable<BaseTexture> = null;

    @serializeAsTexture('outlineWidthTexture')
    private _outlineWidthTexture: Nullable<BaseTexture> = null;
    /**
     * アウトラインの幅の調整テクスチャ
     */
    @expandToProperty('_markAllSubMeshesAsTexturesDirty')
    public outlineWidthTexture: Nullable<BaseTexture> = null;

    @serializeAsTexture('outlineWidthTexture')
    private _uvAnimationMaskTexture: Nullable<BaseTexture> = null;
    /**
     * UV アニメーションマスクテクスチャ
     */
    @expandToProperty('_markAllSubMeshesAsTexturesDirty')
    public uvAnimationMaskTexture: Nullable<BaseTexture> = null;

    /**
     * テクスチャ参照の一覧
     */
    protected get appendedTextures(): Array<Nullable<BaseTexture>> {
        return [
            this._diffuseTexture,
            this._emissiveTexture,
            this._bumpTexture,
            this._shadeTexture,
            this._receiveShadowTexture,
            this._shadingGradeTexture,
            this._rimTexture,
            this._matCapTexture,
            this._outlineWidthTexture,
            this._uvAnimationMaskTexture,
        ];
    }
    /**
     * アクティブなテクスチャ参照の一覧
     */
    protected get appendedActiveTextures(): BaseTexture[] {
        return this.appendedTextures.filter((t) => t !== null) as BaseTexture[];
    }
//#endregion

//#region babylon parameters
    /**
     * 対応最大ライト数
     */
    public readonly maxSimultaneousLights = 16;
    /**
     * Specular 非対応
     */
    public readonly specularSupported = false;
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
    private _useLogarithmicDepth = false;
    /**
     * Logarithmic depth
     * @link http://doc.babylonjs.com/how_to/using_logarithmic_depth_buffer
     */
    @serialize()
    public get useLogarithmicDepth(): boolean {
        return this._useLogarithmicDepth;
    }
    public set useLogarithmicDepth(value: boolean) {
        const newValue = value && this.getScene().getEngine().getCaps().fragmentDepthSupported;
        if (this._useLogarithmicDepth !== newValue) {
            this._useLogarithmicDepth = newValue;
            this._markAllSubMeshesAsMiscDirty();
        }
    }
    @serialize('disableLighting')
    private _disableLighting = false;
    /**
     * ライティングを無効にするかどうか
     */
    @expandToProperty('_markAllSubMeshesAsLightsDirty')
    public disableLighting = false;
    @serialize('twoSidedLighting')
    private _twoSidedLighting = false;
    /**
     * 両面ライティングを行うかどうか
     */
    @expandToProperty('_markAllSubMeshesAsTexturesDirty')
    public twoSidedLighting = false;
    @serialize('useAlphaFromDiffuseTexture')
    private _useAlphaFromDiffuseTexture = true;
    /**
     * Does the transparency come from the diffuse texture alpha channel.
     */
    @expandToProperty("_markAllSubMeshesAsTexturesAndMiscDirty")
    public useAlphaFromDiffuseTexture!: boolean;
    /**
     * アルファテスト時のカットしきい値
     */
    @serialize()
    @expandToProperty('_markAllSubMeshesAsLightsDirty')
    public alphaCutOff = 0.5;
    private _rebuildInParallel = false;
    public get isPrePassCapable(): boolean {
        return false;
    }
    public get canRenderToMRT() {
        return false;
    }
    public readonly prePassConfiguration: PrePassConfiguration;
    public readonly detailMap = new DetailMapConfiguration(this._markAllSubMeshesAsTexturesDirty.bind(this));
//#endregion

//#region Colors
    /**
     * diffuseTexture に乗算される色
     */
    @serializeAsColor3('diffuse')
    public diffuseColor = new Color3(1.0, 1.0, 1.0);
    /**
     * 環境光
     */
    @serialize('ambient')
    public ambientColor = new Color3(0.1, 0.1, 0.1);
    /**
     * シーンの AmbientColor と掛け合わせた後の色
     * @see bindForSubMesh
     * @hidden
     */
    protected globalAmbientColor = new Color3(0.0, 0.0, 0.0);
    /**
     * 純粋加算される発光色
     */
    @serialize('emissive')
    public emissiveColor = new Color3(0.0, 0.0, 0.0);
    /**
     * shadeTexture に乗算される色
     */
    @serialize('shade')
    public shadeColor = new Color3(0.97, 0.81, 0.86);
    /**
     * Rim の色
     */
    @serialize('rim')
    public rimColor = new Color3(0.0, 0.0, 0.0);
    /**
     * アウトラインの色
     */
    @serialize('outline')
    public outlineColor = new Color3(0.0, 0.0, 0.0);
//#endregion

//#region MToon parameters
    private _bumpScale = 1.0;
    @serialize()
    public get bumpScale() {
        return this._bumpScale;
    }
    public set bumpScale(value: number) {
        this._bumpScale = value;
    }
    private _receiveShadowRate = 1.0;
    @serialize()
    public get receiveShadowRate() {
        return this._receiveShadowRate;
    }
    public set receiveShadowRate(value: number) {
        this._receiveShadowRate = Math.max(0.0, Math.min(1.0, value));
        this._markAllSubMeshesAsLightsDirty();
    }
    private _shadingGradeRate = 1.0;
    @serialize()
    public get shadingGradeRate() {
        return this._shadingGradeRate;
    }
    public set shadingGradeRate(value: number) {
        this._shadingGradeRate = Math.max(0.0, Math.min(1.0, value));
        this._markAllSubMeshesAsLightsDirty();
    }
    private _shadeShift = 0.0;
    @serialize()
    public get shadeShift() {
        return this._shadeShift;
    }
    public set shadeShift(value: number) {
        this._shadeShift = Math.max(-1.0, Math.min(1.0, value));
        this._markAllSubMeshesAsLightsDirty();
    }
    private _shadeToony = 0.9;
    @serialize()
    public get shadeToony() {
        return this._shadeToony;
    }
    public set shadeToony(value: number) {
        this._shadeToony = Math.max(0.0, Math.min(1.0, value));
        this._markAllSubMeshesAsLightsDirty();
    }
    private _lightColorAttenuation = 0.0;
    @serialize()
    public get lightColorAttenuation() {
        return this._lightColorAttenuation;
    }
    public set lightColorAttenuation(value: number) {
        this._lightColorAttenuation = Math.max(0.0, Math.min(1.0, value));
        this._markAllSubMeshesAsLightsDirty();
    }
    private _indirectLightIntensity = 0.1;
    @serialize()
    public get indirectLightIntensity() {
        return this._indirectLightIntensity;
    }
    public set indirectLightIntensity(value: number) {
        this._indirectLightIntensity = Math.max(0.0, Math.min(1.0, value));
        this._markAllSubMeshesAsLightsDirty();
    }
    private _rimLightingMix = 0;
    @serialize()
    public get rimLightingMix() {
        return this._rimLightingMix;
    }
    public set rimLightingMix(value: number) {
        this._rimLightingMix = Math.max(0.0, Math.min(1.0, value));
        this._markAllSubMeshesAsLightsDirty();
    }
    private _rimFresnelPower = 1;
    @serialize()
    public get rimFresnelPower() {
        return this._rimFresnelPower;
    }
    public set rimFresnelPower(value: number) {
        this._rimFresnelPower = Math.max(0.0, Math.min(100.0, value));
        this._markAllSubMeshesAsLightsDirty();
    }
    private _rimLift = 0;
    @serialize()
    public get rimLift() {
        return this._rimLift;
    }
    public set rimLift(value: number) {
        this._rimLift = Math.max(0.0, Math.min(1.0, value));
        this._markAllSubMeshesAsLightsDirty();
    }
    private _outlineWidth = 0.5;
    @serialize()
    public get outlineWidth() {
        return this._outlineWidth;
    }
    public set outlineWidth(value: number) {
        this._outlineWidth = Math.max(0.01, Math.min(1.0, value));
        this._markAllSubMeshesAsAttributesDirty();
    }
    private _outlineScaledMaxDistance = 1.0;
    @serialize()
    public get outlineScaledMaxDistance() {
        return this._outlineScaledMaxDistance;
    }
    public set outlineScaledMaxDistance(value: number) {
        this._outlineScaledMaxDistance = Math.max(1.0, Math.min(10.0, value));
        this._markAllSubMeshesAsAttributesDirty();
    }
    private _outlineLightingMix = 1.0;
    @serialize()
    public get outlineLightingMix() {
        return this._outlineLightingMix;
    }
    public set outlineLightingMix(value: number) {
        this._outlineLightingMix = Math.max(0.0, Math.min(1.0, value));
        this._markAllSubMeshesAsAttributesDirty();
    }
    private _uvAnimationScrollX = 0.0;
    @serialize()
    public get uvAnimationScrollX() {
        return this._uvAnimationScrollX;
    }
    public set uvAnimationScrollX(value: number) {
        this._uvAnimationScrollX = value;
        this._markAllSubMeshesAsMiscDirty();
    }
    private _uvAnimationScrollY = 0.0;
    @serialize()
    public get uvAnimationScrollY() {
        return this._uvAnimationScrollY;
    }
    public set uvAnimationScrollY(value: number) {
        this._uvAnimationScrollY = value;
        this._markAllSubMeshesAsMiscDirty();
    }
    private _uvAnimationRotation = 0.0;
    @serialize()
    public get uvAnimationRotation() {
        return this._uvAnimationRotation;
    }
    public set uvAnimationRotation(value: number) {
        this._uvAnimationRotation = value;
        this._markAllSubMeshesAsMiscDirty();
    }

    @serialize('alphaTest')
    private _alphaTest = false;
    @serialize()
    public get alphaTest() {
        return this._alphaTest;
    }
    public set alphaTest(value: boolean) {
        this._alphaTest = value;
        if (value) {
            if (this.alphaBlend) {
                this._transparencyMode = Material.MATERIAL_ALPHATESTANDBLEND;
            } else {
                this._transparencyMode = Material.MATERIAL_ALPHATEST;
            }
        } else {
            this._transparencyMode = Material.MATERIAL_OPAQUE;
        }
        this._markAllSubMeshesAsMiscDirty();
    }
    private _alphaBlend = false;
    @serialize()
    public get alphaBlend() {
        return this._alphaBlend;
    }
    public set alphaBlend(value: boolean) {
        this._alphaBlend = value;
        if (value) {
            this.backFaceCulling = true;
            if (this.alphaTest) {
                this._transparencyMode = Material.MATERIAL_ALPHATESTANDBLEND;
            } else {
                this._transparencyMode = Material.MATERIAL_ALPHABLEND;
            }
        } else {
            this._transparencyMode = Material.MATERIAL_OPAQUE;
        }
        this._markAllSubMeshesAsMiscDirty();
    }
    @serialize('debugMode')
    private _debugMode = DebugMode.None;
    /** @hidden */
    @expandToProperty('_markAllSubMeshesAsMiscDirty')
    public debugMode: DebugMode = DebugMode.None;

    private outlineRenderer?: MToonOutlineRenderer;
    private _outlineWidthMode: OutlineWidthMode = OutlineWidthMode.None;
    public get outlineWidthMode() {
        return this._outlineWidthMode;
    }
    public set outlineWidthMode(value: OutlineWidthMode) {
        this._outlineWidthMode = value;
        if (value !== OutlineWidthMode.None && !this.outlineRenderer) {
            /**
             * このマテリアル用のアウトラインレンダラーを生成する
             */
            this.outlineRenderer = new MToonOutlineRenderer(this.getScene(), this);
        }
        this._markAllSubMeshesAsMiscDirty();
    }
    @expandToProperty('_markAllSubMeshesAsMiscDirty')
    public outlineColorMode: OutlineColorMode = OutlineColorMode.MixedLighting;

    private _cullMode: CullMode = CullMode.Back;
    @serialize()
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
                this.twoSidedLighting = false;
                break;
            case CullMode.Front:
                // 表面を描画しない(=裏面だけ描画する)
                this.backFaceCulling = true;
                this.sideOrientation = Material.CounterClockWiseSideOrientation;
                this.twoSidedLighting = true;
                break;
            case CullMode.Back:
                // 裏面を描画しない(=表面だけ描画する) デフォルト
                this.backFaceCulling = true;
                this.sideOrientation = Material.ClockWiseSideOrientation;
                this.twoSidedLighting = false;
                break;
        }
        this._markAllSubMeshesAsMiscDirty();
    }
    @serialize()
    private _outlineCullMode = CullMode.Front;
    @expandToProperty('_markAllSubMeshesAsMiscDirty')
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
        if (!this.outlineRenderer) {
            return '';
        }
        return this.outlineRenderer.name;
    }
//#endregion
//#endregion

    /**
     * @inheritdoc
     */
    public constructor(name: string, scene: Scene) {
        super(name, scene);

        this.prePassConfiguration = new PrePassConfiguration();

        // シェーダストアに登録する
        if (!Effect.IncludesShadersStore.mtoonUboDeclaration) {
            Effect.IncludesShadersStore.mtoonUboDeclaration = UboDeclaration;
            Effect.IncludesShadersStore.mtoonVertexDeclaration = VertexDeclaration;
            Effect.IncludesShadersStore.mtoonFragmentDeclaration = FragmentDeclaration;
            Effect.IncludesShadersStore.mtoonLightFragment = LightFragment;
            Effect.IncludesShadersStore.mtoonBumpFragment = BumpFragment;
            Effect.ShadersStore.mtoonVertexShader = VertexShader;
            Effect.ShadersStore.mtoonFragmentShader = FragmentShader;
        }

        // Inspector にプロパティを追加
        this.inspectableCustomProperties = this.inspectableCustomProperties || [];
        this.inspectableCustomProperties.concat(getInspectableCustomProperties());
    }

    /**
     * @inheritdoc
     * SubMesh が利用可能かどうかチェックする
     */
    public isReadyForSubMesh(mesh: AbstractMesh, subMesh: SubMesh, useInstances = false): boolean {
        if (subMesh.effect && this.isFrozen) {
            if (subMesh.effect._wasPreviouslyReady) {
                return true;
            }
        }

        if (!subMesh._materialDefines) {
            subMesh.materialDefines = new MToonMaterialDefines();
        }

        const scene = this.getScene();
        const defines = subMesh._materialDefines as MToonMaterialDefines;
        if (this._isReadyForSubMesh(subMesh)) {
            return true;
        }

        const engine = scene.getEngine();

        // Lights
        defines._needNormals = MaterialHelper.PrepareDefinesForLights(
            scene,
            mesh,
            defines,
            this.specularSupported,
            this.maxSimultaneousLights,
            this._disableLighting,
        );

        if (this.outlineWidthMode !== OutlineWidthMode.None) {
            // アウトライン描画のためには normal が必要
            defines._needNormals = true;
        }

        this.applyDefines(defines);

        // Multiview
        MaterialHelper.PrepareDefinesForMultiview(scene, defines);

        MaterialHelper.PrepareDefinesForPrePass(scene, defines, this.canRenderToMRT);

        // Textures
        // defines の変更はシェーダのリコンパイルを必要とするため、必要最小限にする
        // そのため若干冗長な記述となっている
        if (defines._areTexturesDirty) {
            defines._needUVs = false;
            defines.MAINUV1 = false;
            defines.MAINUV2 = false;

            if (scene.texturesEnabled) {
                // 追加テクスチャの用意を確認する
                if (!this.isReadyForTexture(this._diffuseTexture, defines, 'DIFFUSE')
                    || !this.isReadyForTexture(this._emissiveTexture, defines, 'EMISSIVE')
                    || !this.isReadyForTexture(this._shadeTexture, defines, 'SHADE')
                    || !this.isReadyForTexture(this._receiveShadowTexture, defines, 'RECEIVE_SHADOW')
                    || !this.isReadyForTexture(this._shadingGradeTexture, defines, 'SHADING_GRADE')
                    || !this.isReadyForTexture(this._rimTexture, defines, 'RIM')
                    || !this.isReadyForTexture(this._matCapTexture, defines, 'MATCAP')
                    || !this.isReadyForTexture(this._outlineWidthTexture, defines, 'OUTLINE_WIDTH')
                    || !this.isReadyForTexture(this._uvAnimationMaskTexture, defines, 'UV_ANIMATION_MASK')
                ) {
                    return false;
                }
                if (scene.getEngine().getCaps().standardDerivatives && this._bumpTexture) {
                    // Bump texure can not be not blocking.
                    if (!this._bumpTexture.isReady()) {
                        return false;
                    }
                    MaterialHelper.PrepareDefinesForMergedUV(this._bumpTexture, defines, 'BUMP');
                } else {
                    defines.BUMP = false;
                }

                defines.TWOSIDEDLIGHTING = !this._backFaceCulling && this._twoSidedLighting;
            } else {
                defines.DIFFUSE = false;
                defines.EMISSIVE = false;
                defines.SHADE = false;
                defines.RECEIVE_SHADOW = false;
                defines.SHADING_GRADE = false;
                defines.RIM = false;
                defines.MATCAP = false;
                defines.OUTLINE_WIDTH = false;
                defines.BUMP = false;
                defines.UV_ANIMATION_MASK = false;
            }

            defines.PREMULTIPLYALPHA = (this.alphaMode === Constants.ALPHA_PREMULTIPLIED || this.alphaMode === Constants.ALPHA_PREMULTIPLIED_PORTERDUFF);

            defines.ALPHATEST_AFTERALLALPHACOMPUTATIONS = this.transparencyMode !== null;
            defines.ALPHABLEND = this.transparencyMode === null || this.needAlphaBlendingForMesh(mesh);
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
            defines,
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
            subMesh.getRenderingMesh().hasThinInstances,
        );

        // External config
        this.detailMap.prepareDefines(defines, scene);

        // Get correct effect
        if (defines.isDirty) {
            const lightDisposed = defines._areLightsDisposed;
            defines.markAsProcessed();

            // Fallbacks
            const fallbacks = new EffectFallbacks();

            if (defines.BUMP) {
                fallbacks.addFallback(0, 'BUMP');
            }

            if (defines.FOG) {
                fallbacks.addFallback(1, 'FOG');
            }

            if (defines.POINTSIZE) {
                fallbacks.addFallback(0, 'POINTSIZE');
            }

            if (defines.LOGARITHMICDEPTH) {
                fallbacks.addFallback(0, 'LOGARITHMICDEPTH');
            }

            MaterialHelper.HandleFallbacksForShadows(defines, fallbacks, this.maxSimultaneousLights);

            if (defines.MULTIVIEW) {
                fallbacks.addFallback(0, 'MULTIVIEW');
            }

            // Attributes
            const attribs = [VertexBuffer.PositionKind];

            if (defines.NORMAL) {
                attribs.push(VertexBuffer.NormalKind);
            }

            if (defines.TANGENT) {
                attribs.push(VertexBuffer.TangentKind);
            }

            if (defines.UV1) {
                attribs.push(VertexBuffer.UVKind);
            }

            if (defines.UV2) {
                attribs.push(VertexBuffer.UV2Kind);
            }

            MaterialHelper.PrepareAttributesForBones(attribs, mesh, defines, fallbacks);
            MaterialHelper.PrepareAttributesForInstances(attribs, defines);
            MaterialHelper.PrepareAttributesForMorphTargets(attribs, mesh, defines);

            const shaderName = 'mtoon';

            const uniforms = [
                'world', 'view', 'viewProjection', 'vLightsType',
                'visibility', 'mBones',
                'vClipPlane', 'vClipPlane2', 'vClipPlane3', 'vClipPlane4', 'vClipPlane5', 'vClipPlane6',
                'vFogInfos', 'vFogColor', 'pointSize',
                'alphaCutOff', 'logarithmicDepthConstant', 'vTangentSpaceParams', 'boneTextureWidth',

                'vDiffuseColor', 'vDiffuseInfos', 'diffuseMatrix',
                'vEmissiveColor', 'vEmissiveInfos', 'emissiveMatrix',
                'vBumpInfos', 'bumpMatrix',
                'vShadeColor', 'vShadeInfos', 'shadeMatrix',
                'vReceiveShadowInfos', 'receiveShadowMatrix',
                'vShadingGradeInfos', 'shadingGradeMatrix',
                'vRimColor', 'vRimInfos', 'RimMatrix',
                'vMatCapInfos', 'MatCapMatrix',
                'vOutlineColor', 'vOutlineWidthInfos', 'outlineWidthMatrix',
                'aspect', 'isOutline',

                'shadingGradeRate', 'receiveShadowRate', 'shadeShift', 'shadeToony',
                'rimLightingMix', 'rimFresnelPower', 'rimLift',
                'lightColorAttenuation', 'indirectLightIntensity',
                'outlineWidth', 'outlineScaledMaxDistance', 'outlineLightingMix',
                'uvAnimationScrollX', 'uvAnimationScrollY', 'uvAnimationRotation',

                'vEyePosition', 'vEyeUp', 'time',

                "morphTargetTextureInfo", "morphTargetTextureIndices"
            ];

            const samplers = [
                'diffuseSampler', 'emissiveSampler', 'bumpSampler', 'boneSampler',
                'shadeSampler', 'receiveShadowSampler', 'shadingGradeSampler',
                'rimSampler', 'matCapSampler', 'outlineWidthSampler',
                'uvAnimationMaskSampler', 'morphTargets',
            ];

            const uniformBuffers = ['Material', 'Scene'];

            DetailMapConfiguration.AddUniforms(uniforms);
            DetailMapConfiguration.AddSamplers(samplers);

            PrePassConfiguration.AddUniforms(uniforms);
            PrePassConfiguration.AddSamplers(samplers);

            MaterialHelper.PrepareUniformsAndSamplersList({
                uniformsNames: uniforms,
                uniformBuffersNames: uniformBuffers,
                samplers,
                defines,
                maxSimultaneousLights: this.maxSimultaneousLights,
            } as IEffectCreationOptions);

            this.applyDefines(defines);

            const csnrOptions: ICustomShaderNameResolveOptions = {};

            const join = defines.toString();

            const previousEffect = subMesh.effect;
            let effect = scene.getEngine().createEffect(shaderName, {
                attributes: attribs,
                uniformsNames: uniforms,
                uniformBuffersNames: uniformBuffers,
                samplers,
                defines: join,
                fallbacks,
                onCompiled: this.onCompiled,
                onError: this.onError,
                indexParameters: {
                    maxSimultaneousLights: this.maxSimultaneousLights,
                    maxSimultaneousMorphTargets: defines.NUM_MORPH_INFLUENCERS,
                },
                processFinalCode: csnrOptions.processFinalCode,
                multiTarget: defines.PREPASS,
            } as IEffectCreationOptions, engine);

            if (effect) {
                if (this._onEffectCreatedObservable) {
                    onCreatedEffectParameters.effect = effect;
                    onCreatedEffectParameters.subMesh = subMesh;
                    this._onEffectCreatedObservable.notifyObservers(onCreatedEffectParameters);
                }
                // Use previous effect while new one is compiling
                if (this.allowShaderHotSwapping && previousEffect && !effect.isReady()) {
                    effect = previousEffect;
                    this._rebuildInParallel = true;
                    defines.markAsUnprocessed();

                    if (lightDisposed) {
                        // re register in case it takes more than one frame.
                        defines._areLightsDisposed = true;
                        return false;
                    }
                } else {
                    this._rebuildInParallel = false;
                    scene.resetCachedMaterial();
                    subMesh.setEffect(effect, defines);
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
     * @inheritdoc
     * 現在の値をシェーダにバインドする
     * このメソッドは毎フレームごとに呼ばれるため、冗長でも高速化を優先する
     */
    public bindForSubMesh(world: Matrix, mesh: Mesh, subMesh: SubMesh): void {
        const scene = this.getScene();
        const defines = subMesh._materialDefines as MToonMaterialDefines;
        const effect = subMesh.effect;
        if (!defines || !effect) {
            return;
        }
        this._activeEffect = effect;

        // Matrices
        if (!defines.INSTANCES || defines.THIN_INSTANCES) {
            this.bindOnlyWorldMatrix(world);
        }

        // PrePass
        this.prePassConfiguration.bindForSubMesh(this._activeEffect, scene, mesh, world, this.isFrozen);

        // Normal Matrix
        if (defines.OBJECTSPACE_NORMALMAP) {
            world.toNormalMatrix(this._normalMatrix);
            this.bindOnlyNormalMatrix(this._normalMatrix);
        }

        const mustRebind = scene.isCachedMaterialInvalid(this, effect, mesh.visibility);

        MaterialHelper.BindBonesParameters(mesh, effect);
        const ubo = this._uniformBuffer;
        if (mustRebind) {
            ubo.bindToEffect(effect, 'Material');
            this.bindViewProjection(effect);

            if (!ubo.useUbo || !this.isFrozen || !ubo.isSync) {
                if (scene.texturesEnabled) {
                    this.bindTexture(this._diffuseTexture, effect, 'diffuse', 'vDiffuseInfos');
                    this.bindTexture(this._emissiveTexture, effect, 'emissive', 'vEmissiveInfos');
                    if (this._bumpTexture) {
                        ubo.updateFloat3(
                            'vBumpInfos',
                            this._bumpTexture.coordinatesIndex,
                            1.0 / this._bumpTexture.level,
                            this._bumpScale,
                        );
                        const matrix = this._bumpTexture.getTextureMatrix();
                        if (!matrix.isIdentityAs3x2()) {
                            ubo.updateMatrix(`bumpMatrix`, matrix);
                        }
                        effect.setTexture(`bumpSampler`, this._bumpTexture);
                        // bumpTexture は babylon.js のデフォルトと反対の状態である
                        if (scene._mirroredCameraPosition) {
                            ubo.updateFloat2('vTangentSpaceParams', 1.0, 1.0);
                        } else {
                            ubo.updateFloat2('vTangentSpaceParams', -1.0, -1.0);
                        }
                    }
                    this.bindTexture(this._shadeTexture, effect, 'shade', 'vShadeInfos');
                    this.bindTexture(this._receiveShadowTexture, effect, 'receiveShadow', 'vReceiveShadowInfos');
                    this.bindTexture(this._shadingGradeTexture, effect, 'shadingGrade', 'vShadingGradeInfos');
                    this.bindTexture(this._rimTexture, effect, 'rim', 'vRimInfos');
                    this.bindTexture(this._matCapTexture, effect, 'matCap', 'vMatCapInfos');
                    this.bindTexture(this._outlineWidthTexture, effect, 'outlineWidth', 'vOutlineWidthInfos');
                    this.bindTexture(this._uvAnimationMaskTexture, effect, 'uvAnimationMask', 'vUvAnimationMaskInfos');
                }

                if (this._hasAlphaChannel()) {
                    effect.setFloat('alphaCutOff', this.alphaCutOff);
                }
            }

            // Point size
            if (this.pointsCloud) {
                ubo.updateFloat('pointSize', this.pointSize);
            }

            // MToon uniforms
            ubo.updateFloat('receiveShadowRate', this._receiveShadowRate);
            ubo.updateFloat('shadingGradeRate', this._shadingGradeRate);
            ubo.updateFloat('shadeShift', this._shadeShift);
            ubo.updateFloat('shadeToony', this._shadeToony);
            ubo.updateFloat('lightColorAttenuation', this._lightColorAttenuation);
            ubo.updateFloat('indirectLightIntensity', this._indirectLightIntensity);
            ubo.updateFloat('rimLightingMix', this._rimLightingMix);
            ubo.updateFloat('rimFresnelPower', this._rimFresnelPower);
            ubo.updateFloat('rimLift', this._rimLift);
            ubo.updateFloat('outlineWidth', this._outlineWidth);
            ubo.updateFloat('outlineScaledMaxDistance', this._outlineScaledMaxDistance);
            ubo.updateFloat('outlineLightingMix', this._outlineLightingMix);
            ubo.updateFloat('uvAnimationScrollX', this._uvAnimationScrollX);
            ubo.updateFloat('uvAnimationScrollY', this._uvAnimationScrollY);
            ubo.updateFloat('uvAnimationRotation', this._uvAnimationRotation);

            this.detailMap.bindForSubMesh(ubo, scene, this.isFrozen);

            // Clip plane
            MaterialHelper.BindClipPlane(effect, scene);

            // Colors
            scene.ambientColor.multiplyToRef(this.ambientColor, this.globalAmbientColor);
            effect.setColor3('vAmbientColor', this.globalAmbientColor);
            ubo.updateColor4('vDiffuseColor', this.diffuseColor, this.alpha);
            ubo.updateColor3('vEmissiveColor', this.emissiveColor);
            ubo.updateColor3('vShadeColor', this.shadeColor);
            ubo.updateColor3('vRimColor', this.rimColor);
            ubo.updateColor4('vOutlineColor', this.outlineColor, 1.0);

            MaterialHelper.BindEyePosition(effect, scene);
            effect.setVector3('vEyeUp', scene.activeCamera!.upVector);
        }

        if (mustRebind || !this.isFrozen) {
            // `freeze` しない限り毎回更新される値
            if (scene.lightsEnabled && !this.disableLighting) {
                MaterialHelper.BindLights(scene, mesh, effect, defines, this.maxSimultaneousLights, this._rebuildInParallel);
            }

            // View
            if (scene.fogEnabled && mesh.applyFog && scene.fogMode !== Scene.FOGMODE_NONE) {
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
        effect.setFloat('aspect', scene.getEngine().getAspectRatio(scene.activeCamera!));
        effect.setFloat('isOutline', 0.0);
        const t = window.performance.now() / 1000;
        effect.setVector4('time', new Vector4(
            t / 20,
            t,
            t * 2,
            t * 3,
        ));

        this._afterBind(mesh, this._activeEffect);
        ubo.update();
    }

    /**
     * @inheritdoc
     */
    public getAnimatables(): IAnimatable[] {
        const results: IAnimatable[] = [];
        for (const texture of this.appendedActiveTextures) {
            if (texture.animations && texture.animations.length > 0) {
                results.push(texture);
            }
        }

        this.detailMap.getAnimatables(results);

        return results;
    }

    /**
     * @inheritdoc
     */
    public getActiveTextures(): BaseTexture[] {
        const activeTextures = super.getActiveTextures().concat(this.appendedActiveTextures);

        this.detailMap.getActiveTextures(activeTextures);

        return activeTextures;
    }

    /**
     * @inheritdoc
     */
    public hasTexture(texture: BaseTexture): boolean {
        if (super.hasTexture(texture)) {
            return true;
        } else if (this.appendedActiveTextures.length > 0) {
            for (const tex of this.appendedActiveTextures) {
                if (tex === texture) {
                    return true;
                }
            }
        }
        return this.detailMap.hasTexture(texture);
    }

    /**
     * @inheritdoc
     */
    public dispose(
        forceDisposeEffect?: boolean,
        forceDisposeTextures?: boolean,
        notBoundToMesh?: boolean,
    ): void {
        delete this.outlineRenderer;
        if (forceDisposeTextures) {
            for (const texture of this.appendedActiveTextures) {
                texture.dispose();
            }
        }

        this.detailMap.dispose(forceDisposeTextures);

        super.dispose(forceDisposeEffect, forceDisposeTextures, notBoundToMesh);
    }

    /**
     * UniformBufferObject のレイアウトを決定する
     * シェーダー内の `uniform Material` と同じ順序で add する必要がある
     * UBO を利用すると効率的に変数をシェーダに渡せるが、 WebGL v2 のみ対応
     * babylon.js では WebGL v1 の場合自動でフォールバックしてくれる
     * 第二引数は float の数
     */
    protected buildUniformLayout(): void {
        const ubo = this._uniformBuffer;

        ubo.addUniform('vDiffuseColor', 4);
        ubo.addUniform('vDiffuseInfos', 2);
        ubo.addUniform('diffuseMatrix', 16);

        ubo.addUniform('vEmissiveColor', 3);
        ubo.addUniform('vEmissiveInfos', 2);
        ubo.addUniform('emissiveMatrix', 16);

        ubo.addUniform('vBumpInfos', 3);
        ubo.addUniform('bumpMatrix', 16);

        ubo.addUniform('vShadeColor', 3);
        ubo.addUniform('vShadeInfos', 2);
        ubo.addUniform('shadeMatrix', 16);

        ubo.addUniform('vReceiveShadowInfos', 2);
        ubo.addUniform('receiveShadowMatrix', 16);

        ubo.addUniform('vShadingGradeInfos', 2);
        ubo.addUniform('shadingGradeMatrix', 16);

        ubo.addUniform('vRimColor', 3);
        ubo.addUniform('vRimInfos', 2);
        ubo.addUniform('rimMatrix', 16);

        ubo.addUniform('vMatCapInfos', 2);
        ubo.addUniform('matCapMatrix', 16);

        ubo.addUniform('vOutlineColor', 3);
        ubo.addUniform('vOutlineWidthInfos', 2);
        ubo.addUniform('outlineWidthMatrix', 16);

        ubo.addUniform('vUvAnimationMaskInfos', 2);
        ubo.addUniform('uvAnimationMaskMatrix', 16);

        ubo.addUniform('vTangentSpaceParams', 2);
        ubo.addUniform('pointSize', 1);

        ubo.addUniform('shadingGradeRate', 1);
        ubo.addUniform('receiveShadowRate', 1);
        ubo.addUniform('shadeShift', 1);
        ubo.addUniform('shadeToony', 1);
        ubo.addUniform('lightColorAttenuation', 1);
        ubo.addUniform('indirectLightIntensity', 1);
        ubo.addUniform('rimLightingMix', 1);
        ubo.addUniform('rimFresnelPower', 1);
        ubo.addUniform('rimLift', 1);
        ubo.addUniform('outlineWidth', 1);
        ubo.addUniform('outlineScaledMaxDistance', 1);
        ubo.addUniform('outlineLightingMix', 1);
        ubo.addUniform('uvAnimationScrollX', 1);
        ubo.addUniform('uvAnimationScrollY', 1);
        ubo.addUniform('uvAnimationRotation', 1);

        DetailMapConfiguration.PrepareUniformBuffer(ubo);

        ubo.create();
    }

    /**
     * テクスチャ情報をバインドする
     * @param texture
     * @param effect
     * @param name
     * @param infoName
     */
    private bindTexture(texture: Nullable<BaseTexture>, effect: Effect, name: string, infoName: string) {
        if (!texture) {
            return;
        }
        this._uniformBuffer.updateFloat2(infoName, texture.coordinatesIndex, texture.level);
        const matrix = texture.getTextureMatrix();
        if (!matrix.isIdentityAs3x2()) {
            this._uniformBuffer.updateMatrix(`${name}Matrix`, matrix);
        }
        effect.setTexture(`${name}Sampler`, texture);
    }

    /**
     * テクスチャの用意が終わっているか確認する
     * @param texture
     * @param defines
     * @param key
     */
    private isReadyForTexture(texture: Nullable<BaseTexture>, defines: any, key: string): boolean {
        if (!texture) {
            defines[key] = false;
            return true;
        }
        if (!texture.isReadyOrNotBlocking()) {
            return false;
        }
        MaterialHelper.PrepareDefinesForMergedUV(texture, defines, key);
        return true;
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
        switch (this.outlineWidthMode) {
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
        switch (this.outlineColorMode) {
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
     * @inheritdoc
     */
    public getClassName() {
        return 'MToonMaterial';
    }

    /**
     * @inheritdoc
     */
    public needAlphaBlending() {
        if (this._disableAlphaBlending) {
            return false;
        }
        return this._alphaBlend || (this.alpha < 1.0) || this._shouldUseAlphaFromDiffuseTexture();
    }

    /**
     * @inheritdoc
     */
    public needAlphaTesting() {
        if (this._forceAlphaTest) {
            return true;
        }
        return this._alphaTest
            || (this._hasAlphaChannel() && (this._transparencyMode == null || this._transparencyMode === Material.MATERIAL_ALPHATEST));
    }

    /**
     * @inheritdoc
     */
    protected _shouldUseAlphaFromDiffuseTexture(): boolean {
        return this._diffuseTexture != null
            && this._diffuseTexture.hasAlpha
            && this._useAlphaFromDiffuseTexture
            && this._transparencyMode !== Material.MATERIAL_OPAQUE;
    }

    /**
     * @inheritdoc
     */
    protected _hasAlphaChannel(): boolean {
        return (this._diffuseTexture !== null && this._diffuseTexture.hasAlpha); // || this._opacityTexture != null;
    }

    /**
     * @inheritdoc
     */
    public getAlphaTestTexture(): Nullable<BaseTexture> {
        return this.diffuseTexture;
    }

    /**
     * @inheritdoc
     */
    public clone(name: string): MToonMaterial {
        const result = SerializationHelper.Clone(() => new MToonMaterial(name, this.getScene()), this);

        result.name = name;
        result.id = name;

        return result;
    }

    /**
     * @inheritdoc
     */
    public serialize(): any {
        return SerializationHelper.Serialize(this);
    }

    /**
     * @inheritdoc
     */
    public static Parse(parsedMaterial: any, scene: Scene, rootUrl: string): MToonMaterial {
        return SerializationHelper.Parse(() => new MToonMaterial(parsedMaterial.name, scene), parsedMaterial, scene, rootUrl);
    }
//#endregion
}
