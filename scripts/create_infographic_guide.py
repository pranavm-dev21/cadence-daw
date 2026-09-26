import os
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import parse_xml, OxmlElement
from docx.oxml.ns import nsdecls, qn

def create_guide():
    doc = docx.Document()

    # Page Margins (0.6 in for modern magazine / infographic feel)
    for section in doc.sections:
        section.top_margin = Inches(0.6)
        section.bottom_margin = Inches(0.6)
        section.left_margin = Inches(0.6)
        section.right_margin = Inches(0.6)

    # Palette
    C_PRIMARY = RGBColor(14, 116, 144)      # Teal / Cyan (#0E7490)
    C_DARK = RGBColor(15, 23, 42)          # Slate-900 (#0F172A)
    C_SECONDARY = RGBColor(79, 70, 229)    # Indigo (#4F46E5)
    C_AMBER = RGBColor(217, 119, 6)        # Amber (#D97706)
    C_MUTED = RGBColor(100, 116, 139)      # Slate-500 (#64748B)

    HEX_PRIMARY = "0E7490"
    HEX_LIGHT_TEAL = "E0F2FE"
    HEX_DARK = "0F172A"
    HEX_SLATE_50 = "F8FAFC"
    HEX_SLATE_100 = "F1F5F9"
    HEX_SLATE_200 = "E2E8F0"
    HEX_AMBER_LIGHT = "FEF3C7"
    HEX_AMBER_BORDER = "F59E0B"
    HEX_INDIGO_LIGHT = "EEF2FF"
    HEX_GREEN_LIGHT = "DCFCE7"
    HEX_GREEN_BORDER = "16A34A"

    def set_cell_shading(cell, color_hex):
        shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{color_hex}"/>')
        cell._tc.get_or_add_tcPr().append(shd)

    def set_cell_margins(cell, top=140, bottom=140, left=200, right=200):
        tcPr = cell._tc.get_or_add_tcPr()
        tcMar = parse_xml(f'''
            <w:tcMar {nsdecls("w")}>
                <w:top w:w="{top}" w:type="dxa"/>
                <w:bottom w:w="{bottom}" w:type="dxa"/>
                <w:left w:w="{left}" w:type="dxa"/>
                <w:right w:w="{right}" w:type="dxa"/>
            </w:tcMar>
        ''')
        tcPr.append(tcMar)

    def set_cell_borders(cell, top=None, bottom=None, left=None, right=None):
        tcPr = cell._tc.get_or_add_tcPr()
        def_border = 'w:val="none"'
        def b_tag(side, cfg):
            if not cfg: return f'<w:{side} w:val="none"/>'
            return f'<w:{side} w:val="{cfg.get("val","single")}" w:sz="{cfg.get("sz","4")}" w:space="0" w:color="{cfg.get("color","auto")}"/>'
        xml = f'''<w:tcBorders {nsdecls("w")}>
            {b_tag("top", top)}
            {b_tag("left", left)}
            {b_tag("bottom", bottom)}
            {b_tag("right", right)}
        </w:tcBorders>'''
        tcPr.append(parse_xml(xml))

    # Helper: Callout Box
    def add_callout(text, title="PRO TIP", bg_hex=HEX_AMBER_LIGHT, border_hex=HEX_AMBER_BORDER, icon="💡"):
        tbl = doc.add_table(rows=1, cols=1)
        tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
        tbl.autofit = False
        tbl.columns[0].width = Inches(7.2)
        cell = tbl.cell(0, 0)
        set_cell_shading(cell, bg_hex)
        set_cell_margins(cell, top=140, bottom=140, left=220, right=200)
        set_cell_borders(cell, left={"val": "single", "sz": "24", "color": border_hex})
        
        p = cell.paragraphs[0]
        p.paragraph_format.space_before = Pt(2)
        p.paragraph_format.space_after = Pt(2)
        p.paragraph_format.line_spacing = 1.15
        r_icon = p.add_run(f"{icon} {title}: ")
        r_icon.font.name = "Segoe UI"
        r_icon.font.bold = True
        r_icon.font.size = Pt(10.5)
        r_icon.font.color.rgb = C_DARK

        r_text = p.add_run(text)
        r_text.font.name = "Segoe UI"
        r_text.font.size = Pt(10)
        r_text.font.color.rgb = C_DARK

        # Small spacing after table
        sp = doc.add_paragraph()
        sp.paragraph_format.space_before = Pt(0)
        sp.paragraph_format.space_after = Pt(6)

    # -------------------------------------------------------------
    # 1. HERO HEADER BANNER (Infographic Cover Block)
    # -------------------------------------------------------------
    tbl_hero = doc.add_table(rows=1, cols=1)
    tbl_hero.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl_hero.autofit = False
    tbl_hero.columns[0].width = Inches(7.2)
    c_hero = tbl_hero.cell(0, 0)
    set_cell_shading(c_hero, HEX_DARK)
    set_cell_margins(c_hero, top=260, bottom=260, left=300, right=300)
    set_cell_borders(c_hero, bottom={"val": "single", "sz": "24", "color": HEX_PRIMARY})

    p_badge = c_hero.paragraphs[0]
    p_badge.paragraph_format.space_after = Pt(4)
    r_badge = p_badge.add_run("CADENCE DAW  •  BEGINNER INFOGRAPHIC MANUAL")
    r_badge.font.name = "Segoe UI"
    r_badge.font.size = Pt(9.5)
    r_badge.font.bold = True
    r_badge.font.color.rgb = RGBColor(0, 245, 255) # Cyan

    p_title = c_hero.add_paragraph()
    p_title.paragraph_format.space_after = Pt(6)
    r_title = p_title.add_run("From Zero to Your First Hit Beat in 10 Minutes")
    r_title.font.name = "Segoe UI"
    r_title.font.size = Pt(22)
    r_title.font.bold = True
    r_title.font.color.rgb = RGBColor(255, 255, 255)

    p_sub = c_hero.add_paragraph()
    p_sub.paragraph_format.space_after = Pt(0)
    r_sub = p_sub.add_run("No music theory required. Follow this step-by-step visual roadmap to compose, beatmake, mix, and export like a pro.")
    r_sub.font.name = "Segoe UI"
    r_sub.font.size = Pt(11)
    r_sub.font.color.rgb = RGBColor(203, 213, 225) # Slate-300

    doc.add_paragraph().paragraph_format.space_after = Pt(10)

    # -------------------------------------------------------------
    # 2. THE 4 GOLDEN KEYS (FL Studio Standard F-Keys)
    # -------------------------------------------------------------
    p_sec1 = doc.add_paragraph()
    p_sec1.paragraph_format.space_before = Pt(8)
    p_sec1.paragraph_format.space_after = Pt(4)
    r_sec1 = p_sec1.add_run("⚡ The 4 Magic Keys: Your FL Studio Superpower")
    r_sec1.font.name = "Segoe UI"
    r_sec1.font.size = Pt(14)
    r_sec1.font.bold = True
    r_sec1.font.color.rgb = C_PRIMARY

    p_sec1_desc = doc.add_paragraph()
    p_sec1_desc.paragraph_format.space_after = Pt(8)
    r_desc = p_sec1_desc.add_run("Forget searching through menus. Hit these 4 keys to teleport instantly anywhere in Cadence:")
    r_desc.font.name = "Segoe UI"
    r_desc.font.size = Pt(10)
    r_desc.font.color.rgb = C_DARK

    tbl_keys = doc.add_table(rows=1, cols=4)
    tbl_keys.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl_keys.autofit = False
    col_w = Inches(7.2 / 4)

    keys_data = [
        ("F5", "Playlist / Arrangement", "Structure full songs, drag audio clips & pattern blocks.", HEX_LIGHT_TEAL, HEX_PRIMARY),
        ("F6", "Channel Rack", "Make drum beats, 16-step sequencer & groove swing.", HEX_INDIGO_LIGHT, "4F46E5"),
        ("F7", "Piano Roll", "Stamp chords, write melodies, strum guitars & arpeggios.", HEX_AMBER_LIGHT, HEX_AMBER_BORDER),
        ("F9", "Mixer Pro", "10 FX slots, SoftClipper, EQ, reverb, volume faders.", HEX_GREEN_LIGHT, HEX_GREEN_BORDER),
    ]

    for i, (k, title, desc, bg, border) in enumerate(keys_data):
        tbl_keys.columns[i].width = col_w
        c = tbl_keys.cell(0, i)
        set_cell_shading(c, bg)
        set_cell_margins(c, top=140, bottom=140, left=140, right=140)
        set_cell_borders(c, top={"val": "single", "sz": "16", "color": border},
                            left={"val": "single", "sz": "4", "color": HEX_SLATE_200},
                            right={"val": "single", "sz": "4", "color": HEX_SLATE_200},
                            bottom={"val": "single", "sz": "4", "color": HEX_SLATE_200})
        
        p = c.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_after = Pt(2)
        r_k = p.add_run(k)
        r_k.font.name = "Segoe UI"
        r_k.font.size = Pt(16)
        r_k.font.bold = True
        r_k.font.color.rgb = C_DARK

        p_t = c.add_paragraph()
        p_t.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_t.paragraph_format.space_after = Pt(4)
        r_t = p_t.add_run(title)
        r_t.font.name = "Segoe UI"
        r_t.font.size = Pt(9.5)
        r_t.font.bold = True
        r_t.font.color.rgb = C_PRIMARY

        p_d = c.add_paragraph()
        p_d.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_d.paragraph_format.space_after = Pt(0)
        r_d = p_d.add_run(desc)
        r_d.font.name = "Segoe UI"
        r_d.font.size = Pt(8.5)
        r_d.font.color.rgb = C_MUTED

    doc.add_paragraph().paragraph_format.space_after = Pt(10)

    # -------------------------------------------------------------
    # 3. STEP 1: MAKE YOUR FIRST DRUM BEAT (Visual Step Grid)
    # -------------------------------------------------------------
    p_s1 = doc.add_paragraph()
    p_s1.paragraph_format.space_before = Pt(8)
    p_s1.paragraph_format.space_after = Pt(4)
    r_s1 = p_s1.add_run("🥁 Step 1: The Universal Drum Beat (Channel Rack — Press F6)")
    r_s1.font.name = "Segoe UI"
    r_s1.font.size = Pt(13)
    r_s1.font.bold = True
    r_s1.font.color.rgb = C_PRIMARY

    p_s1_desc = doc.add_paragraph()
    p_s1_desc.paragraph_format.space_after = Pt(6)
    r_s1_d = p_s1_desc.add_run("Every hip-hop, pop, and electronic hit uses this exact 16-step formula. Open the Channel Rack and click these buttons:")
    r_s1_d.font.name = "Segoe UI"
    r_s1_d.font.size = Pt(10)
    r_s1_d.font.color.rgb = C_DARK

    # Drum Pattern Diagram Table
    tbl_drums = doc.add_table(rows=5, cols=17)
    tbl_drums.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl_drums.autofit = False
    tbl_drums.columns[0].width = Inches(1.4)
    for c_idx in range(1, 17):
        tbl_drums.columns[c_idx].width = Inches(0.36)

    # Header Row (Steps 1 to 16)
    c_h0 = tbl_drums.cell(0, 0)
    set_cell_shading(c_h0, HEX_DARK)
    c_h0.paragraphs[0].add_run("Instrument").font.color.rgb = RGBColor(255, 255, 255)
    c_h0.paragraphs[0].runs[0].font.bold = True
    c_h0.paragraphs[0].runs[0].font.size = Pt(9)

    for step in range(1, 17):
        c = tbl_drums.cell(0, step)
        # Color group: 4-beat blocks like FL Studio
        bg = "1E293B" if ((step - 1) // 4) % 2 == 0 else "334155"
        set_cell_shading(c, bg)
        p = c.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(str(step))
        r.font.name = "Segoe UI"
        r.font.size = Pt(8.5)
        r.font.bold = True
        r.font.color.rgb = RGBColor(255, 255, 255)

    drum_rows = [
        ("Kick Drum", [1, 9]),               # Beats 1 and 3
        ("Snare / Clap", [5, 13]),           # Beats 2 and 4
        ("Hi-Hat (8ths)", [1, 3, 5, 7, 9, 11, 13, 15]), # Every odd step
        ("808 Bass", [1, 7, 9, 12]),         # Bouncy bounce
    ]

    for r_idx, (inst, active_steps) in enumerate(drum_rows, start=1):
        c_label = tbl_drums.cell(r_idx, 0)
        set_cell_shading(c_label, HEX_SLATE_100)
        set_cell_margins(c_label, top=80, bottom=80, left=100, right=80)
        p_lbl = c_label.paragraphs[0]
        r_lbl = p_lbl.add_run(inst)
        r_lbl.font.name = "Segoe UI"
        r_lbl.font.size = Pt(9)
        r_lbl.font.bold = True
        r_lbl.font.color.rgb = C_DARK

        for step in range(1, 17):
            c_box = tbl_drums.cell(r_idx, step)
            set_cell_margins(c_box, top=60, bottom=60, left=40, right=40)
            is_active = step in active_steps
            bg = HEX_PRIMARY if is_active else ("F1F5F9" if ((step - 1) // 4) % 2 == 0 else "E2E8F0")
            set_cell_shading(c_box, bg)
            set_cell_borders(c_box, top={"val": "single", "sz": "4", "color": "CBD5E1"},
                                    bottom={"val": "single", "sz": "4", "color": "CBD5E1"},
                                    left={"val": "single", "sz": "4", "color": "CBD5E1"},
                                    right={"val": "single", "sz": "4", "color": "CBD5E1"})
            p_b = c_box.paragraphs[0]
            p_b.alignment = WD_ALIGN_PARAGRAPH.CENTER
            if is_active:
                r_act = p_b.add_run("●")
                r_act.font.size = Pt(8.5)
                r_act.font.color.rgb = RGBColor(255, 255, 255)

    doc.add_paragraph().paragraph_format.space_after = Pt(6)

    add_callout(
        "Turn the 'Swing' knob in the Channel Rack toolbar to 55%–65%. This adds micro-groove between hi-hat hits, instantly transforming a robotic computer loop into a bouncing, human groove!",
        title="THE SECRET TO BOUNCE (SWING KNOB)",
        bg_hex=HEX_AMBER_LIGHT,
        border_hex=HEX_AMBER_BORDER,
        icon="🔥"
    )

    # -------------------------------------------------------------
    # 4. STEP 2: MELODIES & CHORDS WITHOUT MUSIC THEORY
    # -------------------------------------------------------------
    p_s2 = doc.add_paragraph()
    p_s2.paragraph_format.space_before = Pt(8)
    p_s2.paragraph_format.space_after = Pt(4)
    r_s2 = p_s2.add_run("🎹 Step 2: Melodies & Chords with Zero Theory (Piano Roll — Press F7)")
    r_s2.font.name = "Segoe UI"
    r_s2.font.size = Pt(13)
    r_s2.font.bold = True
    r_s2.font.color.rgb = C_PRIMARY

    p_s2_desc = doc.add_paragraph()
    p_s2_desc.paragraph_format.space_after = Pt(6)
    r_s2_d = p_s2_desc.add_run("You don't need piano lessons to write beautiful chord progressions. Cadence builds the music theory right into the tools:")
    r_s2_d.font.name = "Segoe UI"
    r_s2_d.font.size = Pt(10)
    r_s2_d.font.color.rgb = C_DARK

    tbl_tools = doc.add_table(rows=4, cols=2)
    tbl_tools.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl_tools.autofit = False
    tbl_tools.columns[0].width = Inches(2.2)
    tbl_tools.columns[1].width = Inches(5.0)

    piano_tools = [
        ("🎹 Chord Stamper", "Click 'Chord Stamp', choose 'Minor Triad' or 'Major 7th', and click the grid. It automatically builds full, harmonic 3-to-4 note chords in one click!"),
        ("🎸 Guitar Strum", "Select your stamped chords and click 'Strum'. Cadence offsets the note start times slightly from bottom string to top, creating a rich acoustic or electric guitar strum."),
        ("✨ Arpeggiator", "Highlight any chord and click 'Arp'. Select 'Up/Down' at 1/16 notes to turn plain held chords into cascading, energetic synth arpeggios."),
        ("🎲 Humanizer", "Click 'Humanize' to add realistic micro-timing imperfections and natural velocity dynamics so your music sounds performed by a living musician."),
    ]

    for idx, (tool_name, tool_desc) in enumerate(piano_tools):
        c1 = tbl_tools.cell(idx, 0)
        c2 = tbl_tools.cell(idx, 1)
        bg = HEX_SLATE_50 if idx % 2 == 0 else "FFFFFF"
        set_cell_shading(c1, bg)
        set_cell_shading(c2, bg)
        set_cell_margins(c1, top=100, bottom=100, left=120, right=100)
        set_cell_margins(c2, top=100, bottom=100, left=120, right=100)
        set_cell_borders(c1, bottom={"val": "single", "sz": "4", "color": HEX_SLATE_200})
        set_cell_borders(c2, bottom={"val": "single", "sz": "4", "color": HEX_SLATE_200})

        p1 = c1.paragraphs[0]
        r1 = p1.add_run(tool_name)
        r1.font.name = "Segoe UI"
        r1.font.size = Pt(10)
        r1.font.bold = True
        r1.font.color.rgb = C_PRIMARY

        p2 = c2.paragraphs[0]
        r2 = p2.add_run(tool_desc)
        r2.font.name = "Segoe UI"
        r2.font.size = Pt(9.5)
        r2.font.color.rgb = C_DARK

    doc.add_paragraph().paragraph_format.space_after = Pt(6)

    # -------------------------------------------------------------
    # 5. STEP 3: SAMPLING & CHOPPING IN EDISON
    # -------------------------------------------------------------
    p_s3 = doc.add_paragraph()
    p_s3.paragraph_format.space_before = Pt(8)
    p_s3.paragraph_format.space_after = Pt(4)
    r_s3 = p_s3.add_run("✂️ Step 3: Chop Samples in Edison (Workspace → Edison)")
    r_s3.font.name = "Segoe UI"
    r_s3.font.size = Pt(13)
    r_s3.font.bold = True
    r_s3.font.color.rgb = C_PRIMARY

    p_s3_desc = doc.add_paragraph()
    p_s3_desc.paragraph_format.space_after = Pt(6)
    r_s3_d = p_s3_desc.add_run("Edison is your visual waveform surgeon. Sampling loops and making vintage chops takes 3 clicks:")
    r_s3_d.font.name = "Segoe UI"
    r_s3_d.font.size = Pt(10)
    r_s3_d.font.color.rgb = C_DARK

    tbl_edison = doc.add_table(rows=1, cols=3)
    tbl_edison.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl_edison.autofit = False
    e_col_w = Inches(7.2 / 3)

    edison_steps = [
        ("1. Drop Any Sample", "Drag any WAV or MP3 audio file into Edison. Zoom in with mouse scroll wheel to inspect every transient wave peak.", HEX_LIGHT_TEAL),
        ("2. Click 'Auto Slice'", "Edison analyzes energy bursts and automatically slices the loop cleanly at every snare, kick, or vocal chop.", HEX_INDIGO_LIGHT),
        ("3. Click 'Dump to Rack'", "Instantly turns your slices into playable drum pads on the Channel Rack! Play the chopped loop on your keyboard keys.", HEX_GREEN_LIGHT),
    ]

    for idx, (stitle, sdesc, bg) in enumerate(edison_steps):
        tbl_edison.columns[idx].width = e_col_w
        c = tbl_edison.cell(0, idx)
        set_cell_shading(c, bg)
        set_cell_margins(c, top=120, bottom=120, left=120, right=120)
        set_cell_borders(c, top={"val": "single", "sz": "16", "color": HEX_PRIMARY})
        
        p_t = c.paragraphs[0]
        r_t = p_t.add_run(stitle)
        r_t.font.name = "Segoe UI"
        r_t.font.size = Pt(10)
        r_t.font.bold = True
        r_t.font.color.rgb = C_DARK

        p_d = c.add_paragraph()
        p_d.paragraph_format.space_before = Pt(4)
        r_d = p_d.add_run(sdesc)
        r_d.font.name = "Segoe UI"
        r_d.font.size = Pt(9)
        r_d.font.color.rgb = C_DARK

    doc.add_paragraph().paragraph_format.space_after = Pt(6)

    # -------------------------------------------------------------
    # 6. STEP 4: SOUND DESIGN & MIXING (MIXER PRO - F9)
    # -------------------------------------------------------------
    p_s4 = doc.add_paragraph()
    p_s4.paragraph_format.space_before = Pt(8)
    p_s4.paragraph_format.space_after = Pt(4)
    r_s4 = p_s4.add_run("🎚️ Step 4: Pro Mixing & FX Rack (Mixer — Press F9)")
    r_s4.font.name = "Segoe UI"
    r_s4.font.size = Pt(13)
    r_s4.font.bold = True
    r_s4.font.color.rgb = C_PRIMARY

    p_s4_desc = doc.add_paragraph()
    p_s4_desc.paragraph_format.space_after = Pt(6)
    r_s4_d = p_s4_desc.add_run("The secret behind modern commercial records is saturation, stereo width, and loudness control. Cadence equips every channel with 10 FX insert slots:")
    r_s4_d.font.name = "Segoe UI"
    r_s4_d.font.size = Pt(10)
    r_s4_d.font.color.rgb = C_DARK

    tbl_fx = doc.add_table(rows=3, cols=2)
    tbl_fx.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl_fx.autofit = False
    tbl_fx.columns[0].width = Inches(2.2)
    tbl_fx.columns[1].width = Inches(5.0)

    fx_data = [
        ("⚡ SoftClipper (The FL Secret)", "Essential for drums & 808s! Place SoftClipper on your Master or Drum bus. It rounds peaks with an analog saturation curve so you can slam your 808s and kicks loud with zero harsh digital distortion."),
        ("🌐 StereoShaper (Haas Widener)", "Use on synths, guitars, or background vocals. Uses micro-delay Haas effects and Mid/Side width processing to push sounds outside the speaker boundaries for huge 3D stereo width."),
        ("📊 Master LUFS Loudness Meter", "Built right into the Master fader. Watch the LUFS readout: aim for -14 LUFS to ensure your song hits Spotify, Apple Music, and YouTube at optimal broadcast volume without being turned down!"),
    ]

    for idx, (fx_name, fx_desc) in enumerate(fx_data):
        c1 = tbl_fx.cell(idx, 0)
        c2 = tbl_fx.cell(idx, 1)
        bg = HEX_SLATE_50 if idx % 2 == 0 else "FFFFFF"
        set_cell_shading(c1, bg)
        set_cell_shading(c2, bg)
        set_cell_margins(c1, top=100, bottom=100, left=120, right=100)
        set_cell_margins(c2, top=100, bottom=100, left=120, right=100)
        set_cell_borders(c1, bottom={"val": "single", "sz": "4", "color": HEX_SLATE_200})
        set_cell_borders(c2, bottom={"val": "single", "sz": "4", "color": HEX_SLATE_200})

        p1 = c1.paragraphs[0]
        r1 = p1.add_run(fx_name)
        r1.font.name = "Segoe UI"
        r1.font.size = Pt(10)
        r1.font.bold = True
        r1.font.color.rgb = C_PRIMARY

        p2 = c2.paragraphs[0]
        r2 = p2.add_run(fx_desc)
        r2.font.name = "Segoe UI"
        r2.font.size = Pt(9.5)
        r2.font.color.rgb = C_DARK

    doc.add_paragraph().paragraph_format.space_after = Pt(6)

    # -------------------------------------------------------------
    # 7. STEP 5: SONG ARRANGEMENT & STRUCTURE
    # -------------------------------------------------------------
    p_s5 = doc.add_paragraph()
    p_s5.paragraph_format.space_before = Pt(8)
    p_s5.paragraph_format.space_after = Pt(4)
    r_s5 = p_s5.add_run("🎼 Step 5: Structuring Your Song (Arrangement — Press F5)")
    r_s5.font.name = "Segoe UI"
    r_s5.font.size = Pt(13)
    r_s5.font.bold = True
    r_s5.font.color.rgb = C_PRIMARY

    p_s5_desc = doc.add_paragraph()
    p_s5_desc.paragraph_format.space_after = Pt(6)
    r_s5_d = p_s5_desc.add_run("Turn your 4-bar loop into a complete 3-minute song. Standard pop & hip-hop arrangement roadmap:")
    r_s5_d.font.name = "Segoe UI"
    r_s5_d.font.size = Pt(10)
    r_s5_d.font.color.rgb = C_DARK

    tbl_arr = doc.add_table(rows=2, cols=5)
    tbl_arr.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl_arr.autofit = False
    arr_col_w = Inches(7.2 / 5)

    arr_blocks = [
        ("Intro (4 Bars)", "Melody only. Establish mood.", HEX_LIGHT_TEAL),
        ("Verse 1 (8 Bars)", "Drums + Bass enter. Vocals lead.", HEX_INDIGO_LIGHT),
        ("Pre-Chorus (4 Bars)", "Snare roll build-up & tension.", HEX_AMBER_LIGHT),
        ("Chorus (8 Bars)", "Full energy! All drums, synths & 808.", HEX_GREEN_LIGHT),
        ("Outro (4 Bars)", "Drums fade, melody carries out.", HEX_SLATE_100),
    ]

    for idx, (b_title, b_desc, b_bg) in enumerate(arr_blocks):
        tbl_arr.columns[idx].width = arr_col_w
        c_top = tbl_arr.cell(0, idx)
        c_bot = tbl_arr.cell(1, idx)
        set_cell_shading(c_top, HEX_DARK)
        set_cell_shading(c_bot, b_bg)
        set_cell_margins(c_top, top=80, bottom=80, left=80, right=80)
        set_cell_margins(c_bot, top=80, bottom=80, left=80, right=80)
        
        p_t = c_top.paragraphs[0]
        p_t.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r_t = p_t.add_run(b_title)
        r_t.font.name = "Segoe UI"
        r_t.font.size = Pt(9)
        r_t.font.bold = True
        r_t.font.color.rgb = RGBColor(255, 255, 255)

        p_b = c_bot.paragraphs[0]
        p_b.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r_b = p_b.add_run(b_desc)
        r_b.font.name = "Segoe UI"
        r_b.font.size = Pt(8.5)
        r_b.font.color.rgb = C_DARK

    doc.add_paragraph().paragraph_format.space_after = Pt(6)

    # -------------------------------------------------------------
    # 8. STEP 6: EXPORTING & RELEASING
    # -------------------------------------------------------------
    p_s6 = doc.add_paragraph()
    p_s6.paragraph_format.space_before = Pt(8)
    p_s6.paragraph_format.space_after = Pt(4)
    r_s6 = p_s6.add_run("🚀 Step 6: Export Your Hit to the World")
    r_s6.font.name = "Segoe UI"
    r_s6.font.size = Pt(13)
    r_s6.font.bold = True
    r_s6.font.color.rgb = C_PRIMARY

    tbl_exp = doc.add_table(rows=2, cols=2)
    tbl_exp.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl_exp.autofit = False
    tbl_exp.columns[0].width = Inches(3.6)
    tbl_exp.columns[1].width = Inches(3.6)

    exp_cards = [
        ("📁 File → Export WAV (Master)", "Renders a crystal-clear 24-bit / 48 kHz uncompressed WAV file. Ready for instant upload to Spotify, Apple Music, SoundCloud, and YouTube with maximum dynamic range."),
        ("📦 File → Export Stems (Multitrack)", "Renders every track to its own separate WAV file (Kick.wav, Snare.wav, Bass.wav, Vocal.wav) in 1 click. Crucial for sending your song to mixing engineers or remixers!"),
    ]

    for idx, (e_title, e_desc) in enumerate(exp_cards):
        c = tbl_exp.cell(0 if idx < 2 else 1, idx % 2)
        set_cell_shading(c, HEX_SLATE_50)
        set_cell_margins(c, top=120, bottom=120, left=140, right=140)
        set_cell_borders(c, left={"val": "single", "sz": "16", "color": HEX_PRIMARY})
        
        p = c.paragraphs[0]
        r_t = p.add_run(e_title)
        r_t.font.name = "Segoe UI"
        r_t.font.size = Pt(10)
        r_t.font.bold = True
        r_t.font.color.rgb = C_PRIMARY

        p2 = c.add_paragraph()
        p2.paragraph_format.space_before = Pt(4)
        r_d = p2.add_run(e_desc)
        r_d.font.name = "Segoe UI"
        r_d.font.size = Pt(9.5)
        r_d.font.color.rgb = C_DARK

    doc.add_paragraph().paragraph_format.space_after = Pt(10)

    # -------------------------------------------------------------
    # 9. CHEAT-SHEET KEYBOARD SHORTCUTS
    # -------------------------------------------------------------
    p_sc = doc.add_paragraph()
    p_sc.paragraph_format.space_before = Pt(8)
    p_sc.paragraph_format.space_after = Pt(4)
    r_sc = p_sc.add_run("⚡ Complete Keyboard Shortcuts Cheat-Sheet")
    r_sc.font.name = "Segoe UI"
    r_sc.font.size = Pt(13)
    r_sc.font.bold = True
    r_sc.font.color.rgb = C_PRIMARY

    tbl_sc = doc.add_table(rows=7, cols=2)
    tbl_sc.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl_sc.autofit = False
    tbl_sc.columns[0].width = Inches(2.2)
    tbl_sc.columns[1].width = Inches(5.0)

    shortcuts = [
        ("Spacebar", "Play / Pause playback"),
        ("Ctrl + Space", "Stop playback and rewind to bar 1"),
        ("F5 / F6 / F7 / F9", "Teleport: Playlist (F5), Channel Rack (F6), Piano Roll (F7), Mixer (F9)"),
        ("R / L", "Toggle Record Arm (R) / Toggle Loop Region mode (L)"),
        ("Ctrl + B", "Duplicate selected clip or pattern to the next bar"),
        ("Ctrl + Z / Ctrl + Y", "Undo last action / Redo last action"),
        ("A to K Keys / Z to B Keys", "Play interactive Musical Keyboard (A-K) / Trigger Drum Pads (Z-B)"),
    ]

    for idx, (shortcut, action) in enumerate(shortcuts):
        c1 = tbl_sc.cell(idx, 0)
        c2 = tbl_sc.cell(idx, 1)
        bg = HEX_SLATE_50 if idx % 2 == 0 else "FFFFFF"
        set_cell_shading(c1, bg)
        set_cell_shading(c2, bg)
        set_cell_margins(c1, top=80, bottom=80, left=120, right=100)
        set_cell_margins(c2, top=80, bottom=80, left=120, right=100)
        set_cell_borders(c1, bottom={"val": "single", "sz": "4", "color": HEX_SLATE_200})
        set_cell_borders(c2, bottom={"val": "single", "sz": "4", "color": HEX_SLATE_200})

        p1 = c1.paragraphs[0]
        r1 = p1.add_run(shortcut)
        r1.font.name = "Consolas"
        r1.font.size = Pt(9.5)
        r1.font.bold = True
        r1.font.color.rgb = C_PRIMARY

        p2 = c2.paragraphs[0]
        r2 = p2.add_run(action)
        r2.font.name = "Segoe UI"
        r2.font.size = Pt(9.5)
        r2.font.color.rgb = C_DARK

    # Footer note
    p_ft = doc.add_paragraph()
    p_ft.paragraph_format.space_before = Pt(16)
    p_ft.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_ft = p_ft.add_run("Cadence DAW v0.1.0 • Built with Passion for Next-Generation Music Producers • Happy Beatmaking!")
    r_ft.font.name = "Segoe UI"
    r_ft.font.size = Pt(9)
    r_ft.font.italic = True
    r_ft.font.color.rgb = C_MUTED

    out_path = os.path.abspath("Cadence_DAW_Beginner_Infographic_Guide.docx")
    doc.save(out_path)
    print(f"SUCCESS: Saved {out_path}")

if __name__ == "__main__":
    create_guide()
