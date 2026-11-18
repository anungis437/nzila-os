/** COMPONENT-ONLY PROTOTYPE: not installed or used by a production reader.
 * Canonical audit encoding for the fixed external read event shape.
 *
 * Mirrors canonicalPythonJson for strings, booleans, nulls, arrays, objects,
 * and safe integers. External receipt fields contain byte/version counts;
 * fractional and unsafe numeric inputs are deliberately outside this contract.
 * This is a pure function body, with no authority, storage or caller grants.
 */
export const EXTERNAL_AUDIT_JSON_FUNCTION = 'public.ue_external_read_json'

export const EXTERNAL_AUDIT_JSON_BODY = `
DECLARE kind text:=jsonb_typeof(value); result text; raw text; point integer; high integer; low integer;
  item record; first_item boolean:=true; number_value numeric;
BEGIN
  IF value IS NULL OR kind='null' THEN RETURN 'null'; END IF;
  IF kind='boolean' THEN RETURN value::text; END IF;
  IF kind='number' THEN
    number_value:=(value::text)::numeric;
    IF number_value<>trunc(number_value) OR abs(number_value)>9007199254740991 THEN
      RAISE EXCEPTION 'EXTERNAL_AUDIT_INTEGER_REQUIRED' USING ERRCODE='22023';
    END IF;
    RETURN trunc(number_value)::text;
  END IF;
  IF kind='string' THEN
    raw:=value #>> '{}'; result:=chr(34);
    FOR position IN 1..char_length(raw) LOOP
      point:=ascii(substr(raw,position,1));
      CASE point
        WHEN 34 THEN result:=result||chr(92)||chr(34);
        WHEN 92 THEN result:=result||chr(92)||chr(92);
        WHEN 8 THEN result:=result||chr(92)||'b';
        WHEN 9 THEN result:=result||chr(92)||'t';
        WHEN 10 THEN result:=result||chr(92)||'n';
        WHEN 12 THEN result:=result||chr(92)||'f';
        WHEN 13 THEN result:=result||chr(92)||'r';
        ELSE
          IF point BETWEEN 32 AND 126 THEN result:=result||chr(point);
          ELSIF point<=65535 THEN result:=result||chr(92)||'u'||lpad(to_hex(point),4,'0');
          ELSE
            high:=55296+(point-65536)/1024; low:=56320+mod(point-65536,1024);
            result:=result||chr(92)||'u'||lpad(to_hex(high),4,'0')||chr(92)||'u'||lpad(to_hex(low),4,'0');
          END IF;
      END CASE;
    END LOOP;
    RETURN result||chr(34);
  END IF;
  IF kind='array' THEN
    result:='[';
    FOR item IN SELECT element FROM jsonb_array_elements(value) WITH ORDINALITY AS a(element,ordinal) ORDER BY ordinal LOOP
      IF NOT first_item THEN result:=result||', '; END IF;
      first_item:=false; result:=result||public.ue_external_read_json(item.element);
    END LOOP;
    RETURN result||']';
  END IF;
  IF kind='object' THEN
    result:='{';
    FOR item IN SELECT key,entry FROM jsonb_each(value) AS o(key,entry) ORDER BY key COLLATE "C" LOOP
      IF NOT first_item THEN result:=result||', '; END IF;
      first_item:=false;
      result:=result||public.ue_external_read_json(to_jsonb(item.key))||': '||public.ue_external_read_json(item.entry);
    END LOOP;
    RETURN result||'}';
  END IF;
  RAISE EXCEPTION 'EXTERNAL_AUDIT_VALUE_UNSUPPORTED' USING ERRCODE='22023';
END;
`
