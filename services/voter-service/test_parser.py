"""Quick test to verify parser works with electoral roll text format."""
from parser import parse_voter_data


# Simulated pymupdf output from the electoral roll PDF (page 3 sample)
SAMPLE_TEXT = """
Assembly Constituency No and Name : 157-METIABURUZ
Section No and Name : 1-Dr.Abdul Khabir Road (Z)

1                          ATR2678928
Name : Abdullah Molla
Fathers Name: lutfar rahaman Molla
House Number : .
Age : 63 Gender : Male

Photo
Available

2                          ATR2381804
Name : SK BELLAL HOSSAIN
Fathers Name: SK NURUL HOQUE
House Number : 149
Age : 63 Gender : Male

Photo
Available

3                          WB/17/114/066529
Name : Nurkesham
Fathers Name: Islam Ismail
House Number : 149
Age : 60 Gender : Female

Photo
Available

5                          ATR2375111
Name : ESMOTARA BIBI
Husbands Name: SK SIRAJUL ISLAM
House Number : 149
Age : 56 Gender : Female

Photo
Available

10                         FKC2410009
Name : Samina Khatoon
Husbands Name: Sk Sahaalam
House Number : 149
Age : 40 Gender : Female

Photo
Available

206                        ATR2893063
Name : NASHIB ANSARI
Mothers Name: PARVIN BOBY
House Number : Z-62/1
Age : 22 Gender : Male

Photo
Available

414                        ATR2674349
Name : Lutafonnesha
Others: Abdulla
House Number : Z-189
Age : 55 Gender : Female

Photo
Available
"""


def test_electoral_roll_parsing():
    voters = parse_voter_data(SAMPLE_TEXT, "en")

    print(f"Total voters parsed: {len(voters)}")
    for v in voters:
        print(f"  #{v.get('serial_no', '?'):>3} | {v['voter_no']:>18} | {v['name']:<25} | "
              f"{v.get('father_or_husband_name', 'N/A'):<25} | "
              f"Age: {v.get('age', '?'):>3} | Gender: {v.get('gender', '?'):<8} | "
              f"House: {v.get('house_number', 'N/A'):<10} | "
              f"Relation: {v.get('relation_type', 'N/A')}")

    assert len(voters) == 7, f"Expected 7 voters, got {len(voters)}"

    # Check first voter
    v1 = voters[0]
    assert v1["voter_no"] == "ATR2678928"
    assert v1["name"] == "Abdullah Molla"
    assert v1["father_or_husband_name"] == "lutfar rahaman Molla"
    assert v1["age"] == 63
    assert v1["gender"] == "Male"
    assert v1.get("relation_type") == "father"

    # Check voter with Husbands Name
    v4 = voters[3]
    assert v4["voter_no"] == "ATR2375111"
    assert v4["name"] == "ESMOTARA BIBI"
    assert v4["father_or_husband_name"] == "SK SIRAJUL ISLAM"
    assert v4["gender"] == "Female"
    assert v4.get("relation_type") == "husband"

    # Check voter with Mothers Name
    v6 = voters[5]
    assert v6["voter_no"] == "ATR2893063"
    assert v6["name"] == "NASHIB ANSARI"
    assert v6["father_or_husband_name"] == "PARVIN BOBY"
    assert v6.get("relation_type") == "mother"

    # Check voter with Others
    v7 = voters[6]
    assert v7["voter_no"] == "ATR2674349"
    assert v7["father_or_husband_name"] == "Abdulla"
    assert v7.get("relation_type") == "other"

    # Check WB/ format voter ID
    v3 = voters[2]
    assert v3["voter_no"] == "WB/17/114/066529"

    print("\nAll assertions passed!")


if __name__ == "__main__":
    test_electoral_roll_parsing()
