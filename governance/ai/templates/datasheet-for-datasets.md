# Datasheet — `<dataset-id>`

> Adapted from Gebru et al., *Datasheets for Datasets* (CACM 2021) for use
> within Nzila. Required for any dataset that **trains, fine-tunes, or
> evaluates** an AI/ML surface listed in [`governance/ai/inventory.json`](../inventory.json),
> and for any synthetic dataset generated under [`governance/ai/synthetic-data-policy.md`](../synthetic-data-policy.md).

| Field | Value |
|-------|-------|
| **Dataset id** | `<slug>` |
| **Version** | |
| **Owner** | |
| **Last updated** | YYYY-MM-DD |
| **Linked surfaces** | `<inventory.json ids>` |

## 1. Motivation

- For what purpose was the dataset created?
- Who created the dataset and on behalf of which entity?
- Who funded the creation of the dataset?

## 2. Composition

- What do the instances represent? (people, documents, transactions, …)
- How many instances are there in total?
- Does the dataset contain all possible instances, or a sample? If a sample, is it representative?
- What data does each instance consist of? (raw text/image/audio/structured)
- Is there a label or target?
- Is any information missing from individual instances?
- Are relationships between individual instances made explicit?
- Are there recommended data splits (train/dev/test)?
- Are there any errors, sources of noise, or redundancies?
- Is the dataset self-contained, or does it link to / rely on external resources?
- Does the dataset contain data that **might be considered confidential**?
- Does the dataset contain data that, if viewed directly, might be **offensive, insulting, threatening, or anxiety-provoking**?
- Does the dataset relate to people? If yes:
  - Does it identify any subpopulations?
  - Is it possible to identify individuals from the dataset?
  - Does the dataset contain data that might be considered sensitive (race, ethnicity, sexual orientation, religion, political opinion, union membership, biometric, health, financial)?

## 3. Collection process

- How was the data acquired?
- What mechanisms or procedures were used to collect the data?
- If the dataset is a sample from a larger set, what was the sampling strategy?
- Who was involved in the data collection process and how were they compensated?
- Over what timeframe was the data collected?
- Were any **ethical review processes** conducted?
- Did you collect the data from individuals directly, or via third parties?
- Were the individuals **notified** about the data collection?
- Did the individuals **consent** to the collection and use of their data?
- If consent was provided, were the individuals provided with a mechanism to **revoke** their consent?
- Has an analysis of the **potential impact of the dataset and its use on data subjects** been conducted?

## 4. Preprocessing / cleaning / labeling

- Was any preprocessing/cleaning/labeling done? (tokenization, anonymization, redaction)
- Was the "raw" data saved in addition to the preprocessed data?
- Is the software used to preprocess/clean/label the data available?

## 5. Uses

- Has the dataset been used for any tasks already? Link them.
- Is there a repository that links to all papers or systems that use the dataset?
- What (other) tasks could the dataset be used for?
- Is there anything about the composition of the dataset, or the way it was collected and preprocessed/cleaned/labeled, that might **impact future uses**? (bias, drift, consent expiry)
- Are there tasks for which the dataset **should not be used**? (e.g., training a Tier-1 surface from a synthetic dataset without bias review)

## 6. Distribution

- Will the dataset be distributed to third parties outside of Nzila?
- How? (storage container, API, package)
- Are there any **IP licenses, copyright, ToS** restrictions?
- Are there any export controls or regulatory restrictions?

## 7. Maintenance

- Who is supporting/hosting/maintaining the dataset?
- How can the owner be contacted?
- Is there an erratum?
- Will the dataset be updated? (correction of labels, addition of new instances, deletion of instances)
- If the dataset relates to people, are there applicable limits on the **retention** of the data?
- Will older versions of the dataset continue to be supported/hosted/maintained?

## References

- Gebru, T., Morgenstern, J., Vecchione, B., et al. (2021). *Datasheets for Datasets.* CACM. <https://arxiv.org/abs/1803.09010>
- Source PDF (Info-Tech bundle): `infotech/Reporting/_extracted/Mitigate-Machine-Bias/06-Datasheets-for-Datasets.pdf`
- Nzila synthetic data policy: [`governance/ai/synthetic-data-policy.md`](../synthetic-data-policy.md)
- Nzila data inventory: [`governance/privacy/data-inventory.json`](../../privacy/data-inventory.json)
