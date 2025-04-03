import pandas as pd
import re

# Reads a CSV file into a data frame
def read_csv_file(file_path):
    try:
        # specify ISO/IEC 8859-1 encoding
        df = pd.read_csv(file_path, encoding="latin1")
        print("CSV file read successfully!")
        return df
    except Exception as e:
        print(f"Error reading CSV file: {e}")
        return None


# Applies any pre-processing
def pre_process_data_frame(df):

    MOST_RECENT_YEAR = "2022"
    EMPTY_CELL_VALUE = "N/A"

    MOST_RECENT_YEAR = "2022"
    EMPTY_CELL_VALUE = "N/A"

    # remove unnecessary columns
    df1 = df.drop(
        [
            "commodityall",
            "information",
            "source1",
            "source2",
            "source3",
            "link1",
            "link2",
            "link3",
        ],
        axis=1,
    )

    # add id column
    df1.insert(0, "id", df1.index)

    # add a status column that is True if a mine is currently open, False otherwise
    df1["active_status"] = (
        (df1["close1"] == "open")
        | (df1["close2"] == "open")
        | (df1["close3"] == "open")
    )

    # replace any "open" values with the most recent year
    df1[["close1", "close2", "close3"]] = df1[["close1", "close2", "close3"]].replace(
        "open", MOST_RECENT_YEAR
    )

    # replace any hyphens with spaces in province names
    df1["province"] = df1["province"].str.replace("-", " ")

    # fill empty cells with "N/A"
    df2 = df1.where(pd.notnull(df1), EMPTY_CELL_VALUE)

    # trim leading and trailing whitespace from string attributes
    df3 = df2.apply(lambda x: x.str.strip() if x.dtype == "object" else x)

    company_columns = ["company1", "company2", "company3", "company4", "company5", "company6"]

    # clean company names
    df3[company_columns] = df3[company_columns].apply(lambda col: col.map(clean_company_name))

    # manually fix data quality issues
    df3.loc[596, "commodity3"] = "Beryllium"
    df3.loc[204, "open3"] = EMPTY_CELL_VALUE
    df3.loc[335, "close1"] = 1970
    df3.loc[291, "close2"] = MOST_RECENT_YEAR
    df3.loc[724, "close2"] = EMPTY_CELL_VALUE

    return df3

def clean_company_name(name):
    if (name != "N/A"):
        name = re.sub(r'\s*\(.*$', '', name) # Remove anything after " ("
        name = re.sub(r'\b(ltd|limited|inc|corp|co|corporation)\b', '', name, flags=re.IGNORECASE) # Remove suffixes
        name = re.sub(r'-', ' ', name)  # Replace hyphens with space
        name = re.sub(r'[^A-Za-z\s]', '', name)  # Remove special characters
        name = re.sub(r'\s+', ' ', name).strip()  # Remove extra spaces
    return name

if __name__ == "__main__":
    file_path = "./data/MinCan _Past and Present Productive Mines of Canada, 1950-2022_March2024.csv"
    df = read_csv_file(file_path)

    pre_processed_df = pre_process_data_frame(df)

    save_file_path = "./data/mines.csv"
    pre_processed_df.to_csv(save_file_path, index=False)
