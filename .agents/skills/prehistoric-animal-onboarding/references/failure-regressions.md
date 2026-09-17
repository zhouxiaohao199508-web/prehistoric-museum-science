# Failure regressions

Use this table while writing the per-animal review contract. Each past defect
must reappear as a named invariant or evidence requirement when the same risk is
present. A build, typecheck, GLB validator pass or isolated still image never
substitutes for the listed evidence.

| Regression | What escaped review | Contract requirement | Minimum proof |
| --- | --- | --- | --- |
| Carnotaurus teeth detached | A broad head/jaw edit moved or failed to move connected geometry coherently | Teeth, tongue and mouth lining remain attached for the complete loop | Baseline mouth close-up plus candidate close-ups at 0/2/4/6/8 seconds and both side views |
| Carnotaurus forelimb duplicated or reversed | A local structural repair was judged from a favourable angle | Limb count, left/right identity and shoulder-to-wrist direction are invariants | Structure inventory plus left, right and front views through the complete loop |
| Carnotaurus tail appeared static | Clip metadata existed but the target region had no visible displacement | Tail motion coverage and full-loop continuity are separate requirements | Region motion metric plus 0/2/4/6/8 paused frames at every declared review angle |
| Anomalocaris appendages were static or spiked | Whole-body motion hid local appendage failure and deformation spikes | Every repeated appendage group must move without topology spikes | Ventral, dorsal and side full-loop evidence plus appendage-region motion coverage |
| Archaeopteryx wings clipped or flickered | Static captures missed a transient transparency/deformation defect | Wing overlap, alpha stability and silhouette continuity hold for the whole cycle | Full-cycle frame scan from both sides with at most 0.25 seconds between samples; no single still may close the issue |
| Spinosaurus started too close | “Can approach more closely” was implemented as “starts closer” | Initial distance and minimum reachable distance are different state assertions | Given/When/Then runtime state record showing both the initial and closest states |
| Closest capture silently reset to the initial camera | The collector applied zoom before reapplying the planned base camera | Establish base camera first, then apply interaction and record observed post-state camera | Closest distance must be smaller than initial and its screenshot bytes must differ |
| Synthetic PNGs claimed headed-browser provenance | Local JSON could self-report Browser/headed without a signed control receipt | Capture provenance is collector-attested, visibly non-uniform, and reviewed by a separate task | Named collector/task attestation, explicit unsigned-provenance warning, state-effect checks and different reviewer task |
| Candidate passed code checks with a visual defect | Engineering tests did not encode the semantic acceptance criterion | Machine pass, agent visual pass and owner approval remain distinct authorities | Structured agent review bound to the exact profile, GLB and collector-attested capture hashes |
| Review used a different model revision | Screenshots were not bound to the final GLB | Loaded runtime SHA equals the locked candidate GLB SHA in every capture | Capture metadata plus screenshot digests |

## Parallel high-risk work

Parallel L3 work is not itself a failure. The owner may deliberately accept the
cost and uncertainty. When parallel work is requested, each animal must have an
isolated workspace, independent review contract, independent stage lock and
hash-bound evidence. A failure or exception for one animal never changes the
state of another.

## Contract deviations and their practical effects

The old authoring guide exposed 250,000 triangles and 200 bones as hard caps,
while the executor also carried quieter 120,000-triangle and 160-bone review
defaults. Saying that a candidate “broke the onboarding default” was therefore
ambiguous. The current three-tier policy names optimisation targets, normal
review ceilings and absolute exception ceilings explicitly and uses the same
values in the guide, Skill and executable gate.

The normal runtime animation contract is exactly one `Idle` clip lasting eight
seconds at 24 fps, with the first and final state continuous and no root drift.
A 7.5-second clip is not automatically ugly, but it breaks deterministic sample
times, makes 0/2/4/6/8-second comparisons impossible without special casing,
and can reset half a second earlier than the viewer, narration or review clock
expects. Retiming is required; this is not a budget exception.

The model budget has three tiers documented in `ANIMAL_AUTHORING_GUIDE.md`.
Crossing a target is an optimisation warning. Crossing the normal review ceiling
requires a profile-bound exception. Crossing the absolute ceiling fails.

- 167 bones is seven above the normal 160-bone review ceiling but below the
  200-bone absolute ceiling. The likely costs are more transform/skin work,
  a larger rig to audit and more opportunities for stray weights. It does not,
  by itself, prove a visible defect.
- 134,666 triangles is 14,666 above the normal 120,000-triangle review ceiling
  and below the 250,000 absolute ceiling. The likely costs are GPU vertex work,
  memory/bandwidth and mobile thermal headroom. It does not, by itself, prove
  that the asset must be rejected.

For both cases, retain the measured value, record why further reduction would
damage the reviewed result, bind the exception to the candidate profile, and
keep the normal mobile and visual evidence. Never raise a shared default merely
to make one candidate pass.
