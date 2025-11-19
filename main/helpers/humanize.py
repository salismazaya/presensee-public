def localize_month_to_string(month: int) -> str:
    months = [
        "Januari",
        "Februari",
        "Maret",
        "April",
        "Mei",
        "Juni",
        "Juli",
        "Agustus",
        "September",
        "Oktober",
        "November",
        "Desember"
    ]

    try:
        return months[month - 1]
    except (KeyError, IndexError):
        raise ValueError("month not found")