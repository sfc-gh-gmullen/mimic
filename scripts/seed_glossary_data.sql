-- Seed data for Business Glossary
-- Adds initial attribute definitions and enumerations

USE SCHEMA CATALOG_DB.CATALOG_SCHEMA;

-- ============================================================================
-- SEED ATTRIBUTE DEFINITIONS
-- ============================================================================

-- filing_type attribute
INSERT INTO ATTRIBUTE_DEFINITIONS (
    ATTRIBUTE_NAME, 
    DISPLAY_NAME, 
    DESCRIPTION, 
    CREATED_BY, 
    CREATED_AT
)
SELECT 
    'filing_type',
    'Filing Type',
    'Categories of insurance filing submissions',
    'system',
    CURRENT_TIMESTAMP()
WHERE NOT EXISTS (
    SELECT 1 FROM ATTRIBUTE_DEFINITIONS WHERE ATTRIBUTE_NAME = 'filing_type'
);

-- ============================================================================
-- SEED ATTRIBUTE ENUMERATIONS
-- ============================================================================

-- filing_type enumeration values
INSERT INTO ATTRIBUTE_ENUMERATIONS (
    ENUMERATION_ID,
    ATTRIBUTE_NAME,
    VALUE_CODE,
    VALUE_DESCRIPTION,
    SORT_ORDER,
    IS_ACTIVE,
    CREATED_BY,
    CREATED_AT
)
SELECT 
    UUID_STRING(),
    'filing_type',
    'Rate',
    'A filing that contains a company''s proposed rates and documents that support the rate filing.',
    1,
    TRUE,
    'system',
    CURRENT_TIMESTAMP()
WHERE NOT EXISTS (
    SELECT 1 FROM ATTRIBUTE_ENUMERATIONS 
    WHERE ATTRIBUTE_NAME = 'filing_type' AND VALUE_CODE = 'Rate'
);

INSERT INTO ATTRIBUTE_ENUMERATIONS (
    ENUMERATION_ID,
    ATTRIBUTE_NAME,
    VALUE_CODE,
    VALUE_DESCRIPTION,
    SORT_ORDER,
    IS_ACTIVE,
    CREATED_BY,
    CREATED_AT
)
SELECT 
    UUID_STRING(),
    'filing_type',
    'Rule',
    'A filing that contains a company''s proposed rules and documents that support the rule filing.',
    2,
    TRUE,
    'system',
    CURRENT_TIMESTAMP()
WHERE NOT EXISTS (
    SELECT 1 FROM ATTRIBUTE_ENUMERATIONS 
    WHERE ATTRIBUTE_NAME = 'filing_type' AND VALUE_CODE = 'Rule'
);

INSERT INTO ATTRIBUTE_ENUMERATIONS (
    ENUMERATION_ID,
    ATTRIBUTE_NAME,
    VALUE_CODE,
    VALUE_DESCRIPTION,
    SORT_ORDER,
    IS_ACTIVE,
    CREATED_BY,
    CREATED_AT
)
SELECT 
    UUID_STRING(),
    'filing_type',
    'Form',
    'A filing that contains a company''s proposed forms and documents that support the form filing.',
    3,
    TRUE,
    'system',
    CURRENT_TIMESTAMP()
WHERE NOT EXISTS (
    SELECT 1 FROM ATTRIBUTE_ENUMERATIONS 
    WHERE ATTRIBUTE_NAME = 'filing_type' AND VALUE_CODE = 'Form'
);

INSERT INTO ATTRIBUTE_ENUMERATIONS (
    ENUMERATION_ID,
    ATTRIBUTE_NAME,
    VALUE_CODE,
    VALUE_DESCRIPTION,
    SORT_ORDER,
    IS_ACTIVE,
    CREATED_BY,
    CREATED_AT
)
SELECT 
    UUID_STRING(),
    'filing_type',
    'Advertisement',
    'A filing that contains a company''s proposed advertisements and documents that support the advertisement filing.',
    4,
    TRUE,
    'system',
    CURRENT_TIMESTAMP()
WHERE NOT EXISTS (
    SELECT 1 FROM ATTRIBUTE_ENUMERATIONS 
    WHERE ATTRIBUTE_NAME = 'filing_type' AND VALUE_CODE = 'Advertisement'
);

INSERT INTO ATTRIBUTE_ENUMERATIONS (
    ENUMERATION_ID,
    ATTRIBUTE_NAME,
    VALUE_CODE,
    VALUE_DESCRIPTION,
    SORT_ORDER,
    IS_ACTIVE,
    CREATED_BY,
    CREATED_AT
)
SELECT 
    UUID_STRING(),
    'filing_type',
    'Multi',
    'A filing that contains components Ex. Rates/Rules, Rated/Forms',
    5,
    TRUE,
    'system',
    CURRENT_TIMESTAMP()
WHERE NOT EXISTS (
    SELECT 1 FROM ATTRIBUTE_ENUMERATIONS 
    WHERE ATTRIBUTE_NAME = 'filing_type' AND VALUE_CODE = 'Multi'
);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT 'Glossary seed data loaded successfully' as status;

SELECT COUNT(*) as attribute_count FROM ATTRIBUTE_DEFINITIONS;
SELECT COUNT(*) as enumeration_count FROM ATTRIBUTE_ENUMERATIONS;

-- Show filing_type enumerations
SELECT 
    VALUE_CODE,
    VALUE_DESCRIPTION,
    SORT_ORDER
FROM ATTRIBUTE_ENUMERATIONS
WHERE ATTRIBUTE_NAME = 'filing_type'
ORDER BY SORT_ORDER;
