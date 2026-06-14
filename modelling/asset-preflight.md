# Asset Preflight — Portfolio 3D Pipeline

A checklist for preparing models before dropping them into the site. The pipeline renders flat grey + halftone, so the rules here are optimised for that aesthetic.

---

## Poly Count Targets

| Context | Target | Hard Limit |
|---|---|---|
| Card thumbnail | 50k–150k tris | 300k |
| Work detail page | 150k–500k tris | 1M |
| Raw ZBrush sculpt | — | Never ship as-is |

Use **Decimation Master** in ZBrush or the **Decimate modifier** in Blender. Since the pipeline renders flat grey, you can be aggressive — silhouette and major surface forms matter more than micro detail. Normal maps compensate for the rest.

---

## Texture Rules

**Strip everything except normal maps.** The pipeline overrides all materials with a flat grey `MeshStandardMaterial`, so colour, roughness, metalness, AO, and emissive maps are downloaded and thrown away.

**Keep:**
- Normal map (`_N`, `_normal`, `_nrm`)

**Strip:**
- Diffuse / albedo / colour
- Roughness / metalness
- AO / ambient occlusion
- Emissive
- Opacity / alpha (unless the model needs cutouts)

If baking from a high-poly sculpt, bake only the normal map onto the low-poly. No need to bake colour or PBR maps for this pipeline.

---

## Export from Blender — Static Model

1. **Decimate first.** Apply a Decimate modifier and hit the target poly count above. Check the mesh looks clean in solid view.
2. **Clean up materials.** You can leave materials as-is — the pipeline overrides them — but stripping down to one material with only a normal map keeps the file lean.
3. Go to **File → Export → glTF 2.0 (.glb/.gltf)**
4. In the export panel, set:
   - Format: **glTF Binary (.glb)** — single file, easiest to serve
   - Include: **Selected Objects** if you only want part of the scene
   - Geometry: **Apply Modifiers** ✓
   - Data → Mesh: **UVs** ✓, **Normals** ✓
   - Data → Material: **Export** ✓ (keep normal map), uncheck everything else if possible
   - Animation: leave off
5. Drop the `.glb` into the site folder.

---

## Export from Blender — Animated Model

The pipeline does not yet support animation playback (AnimationMixer pending), but export it correctly now so it's ready when the pipeline is updated.

### Rig requirements
- Armature must be parented to the mesh
- Apply all transforms on the mesh before skinning (`Ctrl+A → All Transforms`)
- Max ~80 bones for good performance; humanoids typically 50–65

### Export steps
1. Decimate the mesh (see Static section above)
2. Make sure the armature and mesh are both selected; armature is the active object
3. Go to **File → Export → glTF 2.0 (.glb/.gltf)**
4. In the export panel, set:
   - Format: **glTF Binary (.glb)**
   - Include: **Selected Objects** ✓
   - Geometry: **Apply Modifiers** ✓ (Blender will warn about armature — confirm)
   - Data → Mesh: **UVs** ✓, **Normals** ✓, **Vertex Colors** ✗
   - Data → Armature: **Export Deform Bones Only** ✓ (strips control bones)
   - Animation: **Animation** ✓
     - **Limit to Playback Range** ✓
     - **Always Sample Animations** — off unless you have constraints that need baking
     - **NLA Tracks** ✓ if using NLA editor; otherwise leave off and export active action
5. Drop the `.glb` into the site folder.

### Animation tips
- Keep clips short and loopable for the turntable view (idle cycle, breathing, etc.)
- Make sure the first and last keyframe match for a seamless loop
- Keyframe data is light (~100–500KB for a typical humanoid clip) — don't worry about it

---

## Pre-upload Checklist

- [ ] Poly count within target for intended context
- [ ] Only normal map retained (all other textures stripped)
- [ ] File size under 10MB for cards, under 30MB for detail page
- [ ] Model centred at world origin in Blender before export
- [ ] Scale applied (`Ctrl+A → Scale`) before export
- [ ] `.glb` format (not `.gltf` + separate bin)
- [ ] If animated: armature included, action exported, first/last frame loops cleanly
