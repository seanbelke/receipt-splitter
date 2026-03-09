declare module "punctuation-name2symbol" {
  type PunctuateParams = {
    text: string;
    capitalize?: boolean;
  };

  export default function punctuate(input: string | PunctuateParams): string;
}
