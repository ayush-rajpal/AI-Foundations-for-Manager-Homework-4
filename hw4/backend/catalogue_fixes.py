"""Corrections for catalogue rows that shipped with placeholder data.

Three products came with a stub instead of real details: the description read
"Campus Customs product photo (...). Vision blocked; filename-based stub.", the colors
were empty, the tags were just the words of the file name, and the garment type was vague.
The details below were written from each product's photo. fix_catalogue() runs at startup
and only touches rows that still have the stub text, so it's safe to run repeatedly and
also repairs a fresh copy of the database.
"""

import json
import sqlite3

STUB_MARKER = "filename-based stub"

FIXES = {
    "benjamin-franklin-t-shirt": {
        "garment_type": "short-sleeve t-shirt",
        "description": (
            "Heather gray short-sleeve T-shirt featuring the red and blue Benjamin Franklin College crest "
            "with white fleurs-de-lis and diagonal stripes, above black BENJAMIN FRANKLIN COLLEGE lettering."
        ),
        "colors": ["heather gray", "red", "blue", "white", "black"],
        "search_tags": ["Yale", "Benjamin Franklin College", "residential college", "college crest",
                        "gray T-shirt", "short sleeve", "Campus Customs"],
    },
    "berkeley-sweater-fleece-jacket": {
        "garment_type": "full-zip fleece jacket",
        "description": (
            "Heather gray sweater-knit fleece jacket with a full-length zipper, stand-up collar, charcoal trim, "
            "and zippered side pockets, featuring a small red Berkeley College crest with BERKELEY lettering "
            "on the left chest."
        ),
        "colors": ["heather gray", "charcoal gray", "red"],
        "search_tags": ["Yale", "Berkeley College", "residential college", "fleece jacket", "sweater fleece",
                        "full zip", "gray jacket", "Campus Customs"],
    },
    "timothy-dwight-college-crewneck": {
        "garment_type": "crewneck sweatshirt",
        "description": (
            "Heather gray long-sleeve crewneck sweatshirt with ribbed collar, cuffs, and waistband, featuring "
            "a small red and white Timothy Dwight College crest with TIMOTHY DWIGHT lettering on the left chest."
        ),
        "colors": ["heather gray", "red", "white", "black"],
        "search_tags": ["Yale", "Timothy Dwight College", "residential college", "college crest", "crewneck",
                        "gray sweatshirt", "left chest logo", "Campus Customs"],
    },
}


def fix_catalogue(conn: sqlite3.Connection) -> list[str]:
    """Replace stub rows with the corrected details. Returns the product_ids that were fixed."""
    fixed = []
    for product_id, fix in FIXES.items():
        row = conn.execute("SELECT description FROM catalogue WHERE product_id = ?", (product_id,)).fetchone()
        if row is None or STUB_MARKER not in row[0]:
            continue
        conn.execute(
            """UPDATE catalogue
               SET garment_type = ?, description = ?, colors = ?, search_tags = ?, secondary_colors = NULL
               WHERE product_id = ?""",
            (fix["garment_type"], fix["description"], json.dumps(fix["colors"]), json.dumps(fix["search_tags"]), product_id),
        )
        fixed.append(product_id)
    return fixed
